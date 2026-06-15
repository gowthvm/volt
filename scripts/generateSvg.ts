import type { NormalizedSymbol, Point, Pin } from './types';

function computeArcParams(start: Point, mid: Point, end: Point): { rx: number; ry: number; largeArc: boolean; sweep: boolean } | null {
  const d = 2 * (start.x * (mid.y - end.y) + mid.x * (end.y - start.y) + end.x * (start.y - mid.y));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = start.x * start.x + start.y * start.y;
  const b2 = mid.x * mid.x + mid.y * mid.y;
  const c2 = end.x * end.x + end.y * end.y;
  const cx = (a2 * (mid.y - end.y) + b2 * (end.y - start.y) + c2 * (start.y - mid.y)) / d;
  const cy = (a2 * (end.x - mid.x) + b2 * (start.x - end.x) + c2 * (mid.x - start.x)) / d;
  const radius = Math.hypot(start.x - cx, start.y - cy);
  const angle = (px: number, py: number) => Math.atan2(py - cy, px - cx);
  const sa = angle(start.x, start.y);
  const ea = angle(end.x, end.y);
  const twoPi = 2 * Math.PI;
  const saN = ((sa % twoPi) + twoPi) % twoPi;
  const eaN = ((ea % twoPi) + twoPi) % twoPi;
  const sweepDelta = (eaN - saN + twoPi) % twoPi;
  // In SVG Y-down: cross > 0 means mid is clockwise from start→end
  const cross = (mid.x - start.x) * (end.y - start.y) - (mid.y - start.y) * (end.x - start.x);
  return { rx: radius, ry: radius, largeArc: sweepDelta > Math.PI + 1e-10, sweep: cross > 0 };
}

function pinSide(orientation: number): 'left' | 'right' | 'top' | 'bottom' {
  const o = ((orientation % 360) + 360) % 360;
  if (o >= 315 || o < 45) return 'right';
  if (o >= 45 && o < 135) return 'top';
  if (o >= 135 && o < 225) return 'left';
  return 'bottom';
}

function strokeColor(s: { type: string; color?: string }): string {
  return s.color ?? '#ffffff';
}

function minStroke(w: number): number {
  return Math.max(0.3, w);
}

// --- Pinout box geometry ---

export interface PinoutPin {
  name: string;
  number: string;
  side: 'left' | 'right' | 'top' | 'bottom';
  /** Outer tip where wire connects (terminal dot position in SVG viewBox coords) */
  connectionPoint: { x: number; y: number };
  /** Inner end at body edge */
  lineInner: { x: number; y: number };
  /** Label position in SVG viewBox coords */
  labelPos: { x: number; y: number };
  labelAnchor: string;
}

export interface PinoutGeometry {
  pins: PinoutPin[];
  fullW: number;
  fullH: number;
  bodyX: number;
  bodyY: number;
  bodyW: number;
  bodyH: number;
  pinLen: number;
  margin: number;
}

const MIN_PIN_SPACING = 20;
const MIN_BODY_DIM = 80;
const PIN_LEN = 20;
const MARGIN = 30;

/**
 * Compute algorithmic pinout-box geometry.
 * All positions are in SVG viewBox space (0..fullW, 0..fullH).
 * Both SVG generation and normalized-pin computation share this function
 * so terminal dots always match the rendered SVG.
 */
export function computePinoutGeometry(pins: Pick<Pin, 'name' | 'number' | 'orientation'>[]): PinoutGeometry {
  const leftPins = pins.filter((p) => pinSide(p.orientation) === 'left');
  const rightPins = pins.filter((p) => pinSide(p.orientation) === 'right');
  const topPins = pins.filter((p) => pinSide(p.orientation) === 'top');
  const bottomPins = pins.filter((p) => pinSide(p.orientation) === 'bottom');

  const bodyW = Math.max(MIN_BODY_DIM, Math.max(topPins.length, bottomPins.length) * MIN_PIN_SPACING);
  const bodyH = Math.max(MIN_BODY_DIM, Math.max(leftPins.length, rightPins.length) * MIN_PIN_SPACING);
  const fullW = bodyW + 2 * (MARGIN + PIN_LEN);
  const fullH = bodyH + 2 * (MARGIN + PIN_LEN);
  const bodyX = MARGIN + PIN_LEN;
  const bodyY = MARGIN + PIN_LEN;

  const result: PinoutPin[] = [];

  const addPins = (side: 'left' | 'right' | 'top' | 'bottom', sidePins: typeof pins) => {
    const count = sidePins.length;
    const bodyDim = side === 'left' || side === 'right' ? bodyH : bodyW;
    for (let i = 0; i < count; i++) {
      const pin = sidePins[i];
      const t = count <= 1 ? 0.5 : (i + 0.5) / count;
      const mid = bodyDim * t;

      let connX: number, connY: number, innerX: number, innerY: number;
      let labelX: number, labelY: number, labelAnchor: string;

      if (side === 'left') {
        const y = bodyY + mid;
        connX = bodyX - PIN_LEN; connY = y;
        innerX = bodyX; innerY = y;
        // Name inside body, extending rightward
        labelX = innerX + 5; labelY = y; labelAnchor = 'start';
      } else if (side === 'right') {
        const y = bodyY + mid;
        connX = bodyX + bodyW + PIN_LEN; connY = y;
        innerX = bodyX + bodyW; innerY = y;
        // Name inside body, extending leftward
        labelX = innerX - 5; labelY = y; labelAnchor = 'end';
      } else if (side === 'top') {
        const x = bodyX + mid;
        connX = x; connY = bodyY - PIN_LEN;
        innerX = x; innerY = bodyY;
        // Name ABOVE the pin (outside rectangle)
        labelX = x; labelY = connY - 5; labelAnchor = 'middle';
      } else {
        const x = bodyX + mid;
        connX = x; connY = bodyY + bodyH + PIN_LEN;
        innerX = x; innerY = bodyY + bodyH;
        // Name BELOW the pin (outside rectangle)
        labelX = x; labelY = connY + 14; labelAnchor = 'middle';
      }

      result.push({
        name: pin.name,
        number: pin.number,
        side,
        connectionPoint: { x: connX, y: connY },
        lineInner: { x: innerX, y: innerY },
        labelPos: { x: labelX, y: labelY },
        labelAnchor,
      });
    }
  };

  addPins('left', leftPins);
  addPins('right', rightPins);
  addPins('top', topPins);
  addPins('bottom', bottomPins);

  return { pins: result, fullW, fullH, bodyX, bodyY, bodyW, bodyH, pinLen: PIN_LEN, margin: MARGIN };
}

function generatePinoutBox(symbol: NormalizedSymbol): string {
  const geo = computePinoutGeometry(symbol.pins);
  const lines: string[] = [];

  // Scale fonts relative to body size
  const bodyMinDim = Math.min(geo.bodyW, geo.bodyH);
  const pinFont = Math.min(2, Math.max(1, bodyMinDim * 0.03));
  const refFont = Math.min(3, Math.max(1.5, bodyMinDim * 0.04));
  const pinStroke = Math.min(1.5, Math.max(0.15, 2 * Math.max(geo.fullW / 140, geo.fullH / 140)));

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geo.fullW} ${geo.fullH}">`);
  lines.push(`<rect x="${geo.bodyX}" y="${geo.bodyY}" width="${geo.bodyW}" height="${geo.bodyH}" stroke="#ffffff" stroke-width="${pinStroke}" fill="rgba(255,255,255,0.04)"/>`);
  lines.push(`<text x="${geo.bodyX + geo.bodyW / 2}" y="${geo.bodyY + geo.bodyH / 2}" fill="#888" font-size="${refFont}" font-family="monospace" text-anchor="middle" dominant-baseline="middle">${symbol.reference}</text>`);

  for (const pin of geo.pins) {
    const { connectionPoint: cp, lineInner: li } = pin;
    lines.push(`<line x1="${cp.x}" y1="${cp.y}" x2="${li.x}" y2="${li.y}" stroke="#ffd60a" stroke-width="${pinStroke}" stroke-linecap="round"/>`);

    const label = pin.name || pin.number || '?';
    lines.push(`<text x="${pin.labelPos.x}" y="${pin.labelPos.y}" fill="#ffd60a" font-size="${pinFont}" font-family="monospace" text-anchor="${pin.labelAnchor}" dominant-baseline="middle">${label}</text>`);
  }

  lines.push('</svg>');
  return lines.join('\n');
}

/** Padding around symbol content in SVG viewBox units */
export const SVG_PADDING = 4;

/** Collect graphics-only points (excludes pin names) for body bounding box */
export function collectBodyPoints(symbol: NormalizedSymbol): Point[] {
  const pts: Point[] = [];
  for (const g of symbol.graphics) {
    switch (g.type) {
      case 'line': pts.push(g.start, g.end); break;
      case 'polyline': for (const p of g.pts) pts.push(p); break;
      case 'rectangle': pts.push(g.start, g.end); break;
      case 'circle':
        pts.push(
          { x: g.center.x - g.radius, y: g.center.y - g.radius },
          { x: g.center.x + g.radius, y: g.center.y + g.radius }
        );
        break;
      case 'arc': pts.push(g.start, g.mid, g.end); break;
    }
  }
  for (const pin of symbol.pins) {
    pts.push(pin.pos);
    const rad = (pin.orientation * Math.PI) / 180;
    const tipX = pin.pos.x + pin.length * Math.cos(rad);
    const tipY = pin.pos.y + pin.length * Math.sin(rad);
    pts.push({ x: tipX, y: tipY });
  }
  return pts;
}

export interface NamePlacement {
  pin: Pin;
  pos: { x: number; y: number };
  anchor: string;
  fontSize: number;
}

export function computeNamePlacements(symbol: NormalizedSymbol, bodyBox: { minX: number; minY: number; maxX: number; maxY: number } | null): NamePlacement[] {
  // Font scales with body size, clamped 1-2
  const bodyW = bodyBox ? bodyBox.maxX - bodyBox.minX : 50;
  const bodyH = bodyBox ? bodyBox.maxY - bodyBox.minY : 50;
  const bodyMinDim = Math.min(bodyW, bodyH);
  const baseFont = Math.min(2, Math.max(1, bodyMinDim * 0.03));
  const nameOffset = Math.max(2, baseFont * 3);
  const result: NamePlacement[] = [];
  for (const pin of symbol.pins) {
    if (!pin.name) continue;
    const rad = (pin.orientation * Math.PI) / 180;
    const tipX = pin.pos.x + pin.length * Math.cos(rad);
    const tipY = pin.pos.y + pin.length * Math.sin(rad);
    let nameX = tipX + Math.cos(rad) * nameOffset;
    let nameY = tipY + Math.sin(rad) * nameOffset;
    if (bodyBox && nameX >= bodyBox.minX && nameX <= bodyBox.maxX && nameY >= bodyBox.minY && nameY <= bodyBox.maxY) {
      const oppX = tipX - Math.cos(rad) * nameOffset;
      const oppY = tipY - Math.sin(rad) * nameOffset;
      if (!(oppX >= bodyBox.minX && oppX <= bodyBox.maxX && oppY >= bodyBox.minY && oppY <= bodyBox.maxY)) {
        nameX = oppX;
        nameY = oppY;
      }
    }
    let anchor = 'middle';
    if (Math.abs(Math.cos(rad)) > 0.5) anchor = Math.cos(rad) < 0 ? 'end' : 'start';
    result.push({ pin, pos: { x: nameX, y: nameY }, anchor, fontSize: baseFont });
  }
  return result;
}

export function generateSvg(symbol: NormalizedSymbol): string {
  // Complex symbols: pinout-box fallback
  if (symbol.pins.length > 6) {
    return generatePinoutBox(symbol);
  }

  // 1. Graphics-only bounding box (for name overlap detection)
  const bodyPts = collectBodyPoints(symbol);
  if (bodyPts.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><text x="100" y="24" fill="#888" font-size="14" font-family="monospace" text-anchor="middle" dominant-baseline="middle">${symbol.reference}</text><text x="100" y="44" fill="#666" font-size="11" font-family="monospace" text-anchor="middle" dominant-baseline="middle">${symbol.name}</text></svg>`;
  }

  let bodyMinX = Infinity, bodyMinY = Infinity, bodyMaxX = -Infinity, bodyMaxY = -Infinity;
  for (const p of bodyPts) {
    if (p.x < bodyMinX) bodyMinX = p.x;
    if (p.y < bodyMinY) bodyMinY = p.y;
    if (p.x > bodyMaxX) bodyMaxX = p.x;
    if (p.y > bodyMaxY) bodyMaxY = p.y;
  }
  const bodyBox = { minX: bodyMinX, minY: bodyMinY, maxX: bodyMaxX, maxY: bodyMaxY };

  // 2. Compute adjusted pin name positions
  const namePlacements = computeNamePlacements(symbol, bodyBox);

  // 3. Full bounding box from body points + adjusted name positions
  const allPts = [...bodyPts];
  for (const np of namePlacements) {
    allPts.push(np.pos);
    // Text extent along orientation direction (half font-size for dominant-baseline=middle)
    const rad = (np.pin.orientation * Math.PI) / 180;
    const halfFont = np.fontSize / 2;
    allPts.push({ x: np.pos.x + Math.cos(rad) * halfFont, y: np.pos.y + Math.sin(rad) * halfFont });
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const dx = -minX + SVG_PADDING;
  const dy = maxY + SVG_PADDING;
  const vw = maxX - minX + SVG_PADDING * 2;
  const vh = maxY - minY + SVG_PADDING * 2;

  const nx = (x: number) => x + dx;
  const ny = (y: number) => -y + dy;

  // Pin stroke width scaled so rendered width is ~2px on canvas regardless of viewBox
  const pinStroke = Math.min(1.5, Math.max(0.15, 2 * Math.max(vw / 140, vh / 140)));

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}">`);

  for (const g of symbol.graphics) {
    switch (g.type) {
      case 'line':
        lines.push(`<line x1="${nx(g.start.x)}" y1="${ny(g.start.y)}" x2="${nx(g.end.x)}" y2="${ny(g.end.y)}" stroke="${strokeColor(g.stroke)}" stroke-width="${minStroke(g.stroke.width)}" stroke-linecap="round" fill="none"/>`);
        break;
      case 'polyline': {
        const pts = g.pts.map((p) => `${nx(p.x)},${ny(p.y)}`).join(' ');
        let fill = 'none';
        if ('fill' in g && g.fill?.type === 'outline') fill = strokeColor(g.stroke);
        if ('fill' in g && g.fill?.type === 'background') fill = 'rgba(255,255,255,0.06)';
        lines.push(`<polyline points="${pts}" stroke="${strokeColor(g.stroke)}" stroke-width="${minStroke(g.stroke.width)}" stroke-linejoin="round" stroke-linecap="round" fill="${fill}"/>`);
        break;
      }
      case 'rectangle': {
        const rx = nx(Math.min(g.start.x, g.end.x));
        const ry = ny(Math.min(g.start.y, g.end.y));
        const rw = Math.abs(g.end.x - g.start.x);
        const rh = Math.abs(g.end.y - g.start.y);
        let fill = 'none';
        if (g.fill.type === 'outline') fill = strokeColor(g.stroke);
        if (g.fill.type === 'background') fill = 'rgba(255,255,255,0.06)';
        lines.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" stroke="${strokeColor(g.stroke)}" stroke-width="${minStroke(g.stroke.width)}" fill="${fill}"/>`);
        break;
      }
      case 'circle': {
        let fill = 'none';
        if (g.fill.type === 'outline') fill = strokeColor(g.stroke);
        if (g.fill.type === 'background') fill = 'rgba(255,255,255,0.06)';
        lines.push(`<circle cx="${nx(g.center.x)}" cy="${ny(g.center.y)}" r="${g.radius}" stroke="${strokeColor(g.stroke)}" stroke-width="${minStroke(g.stroke.width)}" fill="${fill}"/>`);
        break;
      }
      case 'arc': {
        const sx = nx(g.start.x), sy = ny(g.start.y);
        const ex = nx(g.end.x), ey = ny(g.end.y);
        const arcP = computeArcParams({ x: g.start.x, y: -g.start.y }, { x: g.mid.x, y: -g.mid.y }, { x: g.end.x, y: -g.end.y });
        if (arcP) {
          const large = arcP.largeArc ? 1 : 0;
          const sweep = arcP.sweep ? 1 : 0;
          lines.push(`<path d="M ${sx} ${sy} A ${arcP.rx} ${arcP.ry} 0 ${large} ${sweep} ${ex} ${ey}" stroke="${strokeColor(g.stroke)}" stroke-width="${minStroke(g.stroke.width)}" fill="none"/>`);
        }
        break;
      }
    }
  }

  for (const pin of symbol.pins) {
    const rad = (pin.orientation * Math.PI) / 180;
    const tipX = pin.pos.x + pin.length * Math.cos(rad);
    const tipY = pin.pos.y + pin.length * Math.sin(rad);

    if (pin.length > 0.001) {
      lines.push(`<line x1="${nx(pin.pos.x)}" y1="${ny(pin.pos.y)}" x2="${nx(tipX)}" y2="${ny(tipY)}" stroke="#ffd60a" stroke-width="${pinStroke}" stroke-linecap="round"/>`);
    }

    if (pin.name) {
      const np = namePlacements.find((n) => n.pin === pin);
      if (np) {
        lines.push(`<text x="${nx(np.pos.x)}" y="${ny(np.pos.y)}" fill="#ffd60a" font-size="${np.fontSize}" font-family="monospace" text-anchor="${np.anchor}" dominant-baseline="middle">${pin.name}</text>`);
      }
    }
  }

  lines.push('</svg>');
  return lines.join('\n');
}
