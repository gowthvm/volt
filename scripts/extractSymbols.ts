import type { SExpr } from './parseKicadSym';
import { listChildren, findChild, findChildren, atomValue, numberValue, stringValue } from './parseKicadSym';
import type { NormalizedSymbol, Pin, Graphic, Point, Stroke, Fill } from './types';

export function extractSymbols(sexprs: SExpr[], sourceFile: string): NormalizedSymbol[] {
  const lib = sexprs.find((s) => s.type === 'list' && s.children[0]?.type === 'atom' && s.children[0].value === 'kicad_symbol_lib');
  if (!lib || lib.type !== 'list') return [];

  const symbols: NormalizedSymbol[] = [];
  const symbolNodes = findChildren(lib, 'symbol');

  for (const symNode of symbolNodes) {
    try {
      const sym = extractOneSymbol(symNode, sourceFile);
      if (sym) symbols.push(sym);
    } catch (err) {
      const name = stringValue(symNode.children[1]) ?? 'unknown';
      console.warn(`[warn] Failed to extract symbol "${name}" in ${sourceFile}: ${err}`);
    }
  }

  return symbols;
}

/** Resolve inheritance: for any symbol with (extends "Parent"), deep-merge pins+graphics from parent */
export function resolveExtends(symbols: NormalizedSymbol[], allSymbols: Map<string, NormalizedSymbol>): void {
  for (const sym of symbols) {
    if (sym.extends) {
      const parentId = sym.extends;
      const parent = allSymbols.get(parentId);
      if (parent) {
        // Merge parent's pins (dedup by number+position)
        const seenKeys = new Set(sym.pins.map((p) => `${p.number}:${p.pos.x.toFixed(2)}:${p.pos.y.toFixed(2)}`));
        for (const pp of parent.pins) {
          const key = `${pp.number}:${pp.pos.x.toFixed(2)}:${pp.pos.y.toFixed(2)}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            sym.pins.push({ ...pp });
          }
        }
        // Merge parent's graphics
        sym.graphics.push(...parent.graphics);
      }
    }
  }
}

function extractOneSymbol(node: SExpr, sourceFile: string): NormalizedSymbol | null {
  const children = listChildren(node);
  const nameAtom = children[1];
  if (!nameAtom) return null;
  const id = stringValue(nameAtom) ?? atomValue(nameAtom) ?? 'unknown';

  if (id === 'power') return null;

  // Check for extends
  const extendsNode = findChild(node, 'extends');
  const extendsId = extendsNode ? stringValue(listChildren(extendsNode)[1]) ?? atomValue(listChildren(extendsNode)[1]) ?? undefined : undefined;

  // Extract properties
  const propertyNodes = findChildren(node, 'property');
  const props = new Map<string, string>();
  for (const pn of propertyNodes) {
    const pChildren = listChildren(pn);
    if (pChildren.length < 3) continue;
    const key = stringValue(pChildren[1]) ?? atomValue(pChildren[1]) ?? '';
    const val = stringValue(pChildren[2]) ?? atomValue(pChildren[2]) ?? '';
    props.set(key, val);
  }

  const reference = props.get('Reference') ?? '?';
  const name = props.get('Value') ?? id;
  const description = props.get('Description') ?? '';
  const keywordsStr = props.get('ki_keywords') ?? '';
  const keywords = keywordsStr.split(/\s+/).filter(Boolean);
  const fpFiltersStr = props.get('ki_fp_filters') ?? '';
  const fpFilters = fpFiltersStr.split(/\s+/).filter(Boolean);
  const datasheet = props.get('Datasheet') ?? '';

  // Extract sub-symbol units
  const subSymbols = findChildren(node, 'symbol');
  const unitCounts = new Set<string>();
  for (const ss of subSymbols) {
    const ssChildren = listChildren(ss);
    if (ssChildren.length < 2) continue;
    const ssName = stringValue(ssChildren[1]) ?? atomValue(ssChildren[1]) ?? '';
    const parts = ssName.split('_');
    if (parts.length >= 2) {
      const possibleUnit = parts[parts.length - 1];
      if (/^\d+$/.test(possibleUnit)) {
        unitCounts.add(possibleUnit);
      } else if (parts.length >= 3) {
        const penultimate = parts[parts.length - 2];
        if (/^\d+$/.test(penultimate)) unitCounts.add(penultimate);
      }
    }
  }

  const units = Math.max(unitCounts.size, 1);

  // Extract pins and graphics from all sub-symbols
  const allPins: Pin[] = [];
  const allGraphics: Graphic[] = [];
  const seenPins = new Set<string>();

  for (const ss of subSymbols) {
    const { pins, graphics } = extractSubSymbol(ss);
    for (const pin of pins) {
      const key = `${pin.number}:${pin.pos.x.toFixed(2)}:${pin.pos.y.toFixed(2)}`;
      if (!seenPins.has(key)) {
        seenPins.add(key);
        allPins.push(pin);
      }
    }
    allGraphics.push(...graphics);
  }

  // Also check pins directly on the main symbol
  const { pins: directPins, graphics: directGraphics } = extractSubSymbol(node);
  for (const pin of directPins) {
    const key = `${pin.number}:${pin.pos.x.toFixed(2)}:${pin.pos.y.toFixed(2)}`;
    if (!seenPins.has(key)) {
      seenPins.add(key);
      allPins.push(pin);
    }
  }
  allGraphics.push(...directGraphics);

  return {
    id: id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed',
    name,
    reference,
    description,
    keywords,
    fpFilters,
    datasheet,
    pins: allPins,
    graphics: allGraphics,
    units,
    sourceFile,
    extends: extendsId ? extendsId.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed' : undefined,
  };
}

function extractSubSymbol(node: SExpr): { pins: Pin[]; graphics: Graphic[] } {
  const pins: Pin[] = [];
  const graphics: Graphic[] = [];

  const children = listChildren(node);
  for (const child of children) {
    if (child.type !== 'list') continue;
    const tag = child.children[0];
    if (tag?.type !== 'atom') continue;

    switch (tag.value) {
      case 'pin':
        try {
          const pin = parsePin(child);
          if (pin) pins.push(pin);
        } catch { /* skip malformed pins */ }
        break;
      case 'polyline':
        try { const pl = parsePolyline(child); if (pl) graphics.push(pl); } catch { /* skip */ }
        break;
      case 'rectangle':
        try { const rect = parseRectangle(child); if (rect) graphics.push(rect); } catch { /* skip */ }
        break;
      case 'circle':
        try { const circ = parseCircle(child); if (circ) graphics.push(circ); } catch { /* skip */ }
        break;
      case 'arc':
        try { const arc = parseArc(child); if (arc) graphics.push(arc); } catch { /* skip */ }
        break;
      case 'bezier':
        break;
      default:
        break;
    }
  }

  return { pins, graphics };
}

function parsePoint(node: SExpr): Point | null {
  const children = listChildren(node);
  let cx = children;
    if (cx.length > 0 && cx[0].type === 'atom' && ['start', 'end', 'center', 'mid', 'xy'].includes(cx[0].value)) {
    cx = cx.slice(1);
  }
  if (cx.length === 1 && cx[0].type === 'list') {
    const nested = listChildren(cx[0]);
    if (nested.length >= 2 && nested[0].type === 'atom' && nested[0].value === 'xy') {
      return { x: numberValue(nested[1]) ?? 0, y: numberValue(nested[2]) ?? 0 };
    }
  }
  if (cx.length < 2) {
    const xyChild = children.find(c => c.type === 'list' && c.children[0]?.type === 'atom' && c.children[0].value === 'xy');
    if (xyChild && xyChild.type === 'list') {
      const xyKids = listChildren(xyChild);
      return { x: numberValue(xyKids[1]) ?? 0, y: numberValue(xyKids[2]) ?? 0 };
    }
    return null;
  }
  const x = numberValue(cx[0]);
  const y = numberValue(cx[1]);
  if (x === undefined || y === undefined) return null;
  return { x, y };
}

function parseStroke(node: SExpr): Stroke {
  const children = listChildren(node);
  let width = 0.254;
  let type = 'default';
  for (const child of children) {
    if (child.type !== 'list') continue;
    const tag = child.children[0];
    if (tag?.type !== 'atom') continue;
    if (tag.value === 'width') {
      width = numberValue(child.children[1]) ?? width;
    } else if (tag.value === 'type') {
      type = stringValue(child.children[1]) ?? atomValue(child.children[1]) ?? type;
    }
  }
  return { width, type };
}

function parseFill(node: SExpr): Fill {
  const children = listChildren(node);
  let type = 'none';
  for (const child of children) {
    if (child.type !== 'list') continue;
    const tag = child.children[0];
    if (tag?.type !== 'atom') continue;
    if (tag.value === 'type') {
      type = stringValue(child.children[1]) ?? atomValue(child.children[1]) ?? type;
    }
  }
  return { type };
}

function parsePin(node: SExpr): Pin | null {
  const children = listChildren(node);
  if (children.length < 2) return null;
  const electricalType = atomValue(children[1]) ?? 'passive';
  const graphicStyle = atomValue(children[2]) ?? 'line';

  const atNode = findChild(node, 'at');
  let pos: Point = { x: 0, y: 0 };
  let orientation = 270;
  if (atNode) {
    const atChildren = listChildren(atNode);
    pos = {
      x: numberValue(atChildren[1]) ?? 0,
      y: numberValue(atChildren[2]) ?? 0,
    };
    orientation = numberValue(atChildren[3]) ?? 270;
  }

  const lengthNode = findChild(node, 'length');
  const pinLength = lengthNode ? numberValue(listChildren(lengthNode)[1]) ?? 2.54 : 2.54;

  const nameNode = findChild(node, 'name');
  const pinName = nameNode ? stringValue(listChildren(nameNode)[1] ?? nameNode.children[1]) ?? '' : '';

  const numberNode = findChild(node, 'number');
  const pinNumber = numberNode ? stringValue(listChildren(numberNode)[1] ?? numberNode.children[1]) ?? '' : '';

  return { name: pinName, number: pinNumber, pos, length: pinLength, orientation, electricalType, graphicStyle };
}

function parsePolyline(node: SExpr): Graphic | null {
  const ptsNode = findChild(node, 'pts');
  if (!ptsNode) return null;
  const ptNodes = findChildren(ptsNode, 'xy');
  const pts: Point[] = [];
  for (const ptNode of ptNodes) {
    const ptChildren = listChildren(ptNode);
    const start = (ptChildren.length > 0 && ptChildren[0].type === 'atom' && ptChildren[0].value === 'xy') ? 1 : 0;
    if (ptChildren.length < start + 2) continue;
    const x = numberValue(ptChildren[start]);
    const y = numberValue(ptChildren[start + 1]);
    if (x !== undefined && y !== undefined) pts.push({ x, y });
  }
  if (pts.length < 2) return null;
  const strokeNode = findChild(node, 'stroke');
  const stroke = strokeNode ? parseStroke(strokeNode) : { width: 0.254, type: 'default' };
  const fillNode = findChild(node, 'fill');
  const fill = fillNode ? parseFill(fillNode) : { type: 'none' };
  if (pts.length === 2) {
    return { type: 'line', start: pts[0], end: pts[1], stroke };
  }
  return { type: 'polyline', pts, stroke, fill };
}

function parseRectangle(node: SExpr): Graphic | null {
  const startNode = findChild(node, 'start');
  const endNode = findChild(node, 'end');
  if (!startNode || !endNode) return null;
  const start = parsePoint(startNode);
  const end = parsePoint(endNode);
  if (!start || !end) return null;
  const strokeNode = findChild(node, 'stroke');
  const stroke = strokeNode ? parseStroke(strokeNode) : { width: 0.254, type: 'default' };
  const fillNode = findChild(node, 'fill');
  const fill = fillNode ? parseFill(fillNode) : { type: 'none' };
  return { type: 'rectangle', start, end, stroke, fill };
}

function parseCircle(node: SExpr): Graphic | null {
  const centerNode = findChild(node, 'center');
  const radiusNode = findChild(node, 'radius');
  if (!centerNode || !radiusNode) return null;
  const center = parsePoint(centerNode);
  const radius = numberValue(listChildren(radiusNode)[1] ?? radiusNode.children[1]);
  if (!center || radius === undefined) return null;
  const strokeNode = findChild(node, 'stroke');
  const stroke = strokeNode ? parseStroke(strokeNode) : { width: 0.254, type: 'default' };
  const fillNode = findChild(node, 'fill');
  const fill = fillNode ? parseFill(fillNode) : { type: 'none' };
  return { type: 'circle', center, radius, stroke, fill };
}

function parseArc(node: SExpr): Graphic | null {
  const startNode = findChild(node, 'start');
  const midNode = findChild(node, 'mid');
  const endNode = findChild(node, 'end');
  if (!startNode || !midNode || !endNode) return null;
  const start = parsePoint(startNode);
  const mid = parsePoint(midNode);
  const end = parsePoint(endNode);
  if (!start || !mid || !end) return null;
  const strokeNode = findChild(node, 'stroke');
  const stroke = strokeNode ? parseStroke(strokeNode) : { width: 0.254, type: 'default' };
  return { type: 'arc', start, mid, end, stroke };
}
