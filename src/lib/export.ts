import type { SchematicComponent } from '@/store/schematicStore';
import type { Stroke } from '@/store/drawingStore';
import type { EditorMode } from '@/store/editorModeStore';
import { componentTerminalDefinitions, transformPoint, computeOrthogonalPath } from '@/circuit/graph';
import { serializeState } from '@/lib/serialize';

const FALLBACK_SVG = '<circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="currentColor" font-family="sans-serif">?</text>';

const svgCache = new Map<string, string>();

export async function preloadSymbolSVG(symId: string): Promise<string | null> {
  if (svgCache.has(symId)) return svgCache.get(symId)!;
  try {
    const res = await fetch(`/assets/symbols/previews/${symId}.svg`);
    if (!res.ok) throw new Error('Not found');
    const text = await res.text();
    const match = text.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    const content = match ? match[1].trim() : '';
    svgCache.set(symId, content);
    return content;
  } catch {
    svgCache.set(symId, '');
    return null;
  }
}

function getEmbeddedSVG(symId: string): string {
  const cached = svgCache.get(symId);
  if (cached !== undefined) return cached || FALLBACK_SVG;
  return FALLBACK_SVG;
}

function computeBounds(components: SchematicComponent[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const comp of components) {
    const size = 60;
    minX = Math.min(minX, comp.position.x - size * Math.abs(comp.scale.x));
    minY = Math.min(minY, comp.position.y - size * Math.abs(comp.scale.y));
    maxX = Math.max(maxX, comp.position.x + size * Math.abs(comp.scale.x));
    maxY = Math.max(maxY, comp.position.y + size * Math.abs(comp.scale.y));
    if (comp.type === 'wire' && comp.points) {
      for (const p of comp.points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    }
  }
  if (!isFinite(minX)) { minX = -200; minY = -200; maxX = 200; maxY = 200; }
  return { minX, minY, maxX, maxY };
}

function getTerminalWorldPos(comp: SchematicComponent, terminalName: string): { x: number; y: number } | null {
  const defs = componentTerminalDefinitions(comp);
  const def = defs.find((d) => d.name === terminalName);
  if (!def) return null;
  return transformPoint(def.point, comp);
}

function getWirePathPoints(comp: SchematicComponent, terminalMap: Record<string, { position: { x: number; y: number } }>): { x: number; y: number }[] | null {
  if (comp.points && comp.points.length >= 2) return comp.points.map((p) => ({ x: p.x, y: p.y }));
  if (!comp.terminalA || !comp.terminalB) return null;
  const tA = terminalMap[comp.terminalA];
  const tB = terminalMap[comp.terminalB];
  if (!tA || !tB) return null;
  return computeOrthogonalPath(tA.position, tB.position);
}

export function generateExportSVG(components: SchematicComponent[], strokes?: Stroke[], terminalMap?: Record<string, { position: { x: number; y: number } }>): string {
  const padding = 50;
  const bounds = computeBounds(components);
  const w = Math.max(100, bounds.maxX - bounds.minX + padding * 2);
  const h = Math.max(100, bounds.maxY - bounds.minY + padding * 2);
  const vbX = bounds.minX - padding;
  const vbY = bounds.minY - padding;
  const tm = terminalMap ?? {};

  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${w} ${h}" width="${w}" height="${h}">`,
    `  <rect x="${vbX}" y="${vbY}" width="${w}" height="${h}" fill="#050505"/>`,
    `  <style>text{fill:#fff;font-family:monospace;font-size:10px;text-anchor:middle}</style>`,
  ];

  for (const comp of components) {
    if (comp.type === 'wire') {
      const pts = getWirePathPoints(comp, tm);
      if (pts && pts.length >= 2) {
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        parts.push(`    <path d="${d}" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
      continue;
    }

    const deg = (comp.rotation * 180) / Math.PI;
    const tx = comp.position.x;
    const ty = comp.position.y;
    const sx = comp.scale.x;
    const sy = comp.scale.y;

    parts.push(`    <g transform="translate(${tx} ${ty}) rotate(${deg}) scale(${sx} ${sy}) translate(-50 -50)" color="#fff">`);
    if (comp.kicadSymbolId) {
      const svgContent = getEmbeddedSVG(comp.kicadSymbolId);
      parts.push(`      ${svgContent}`);
    } else {
      parts.push(`      ${FALLBACK_SVG}`);
    }
    parts.push(`    </g>`);

    if (comp.refdes) {
      parts.push(`    <text x="${tx}" y="${ty + 20 * comp.scale.y}">${comp.refdes}</text>`);
    }
  }

  if (strokes) {
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      parts.push(`    <path d="${d}" stroke="${s.color ?? '#888'}" stroke-width="${s.width ?? 2}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>`);
    }
  }

  parts.push(`</svg>`);
  return parts.join('\n');
}

export async function downloadSVG(components: SchematicComponent[], strokes?: Stroke[]): Promise<void> {
  const symIds = new Set(components.filter((c) => c.kicadSymbolId).map((c) => c.kicadSymbolId!));
  await Promise.all(Array.from(symIds).map(preloadSymbolSVG));
  const svg = generateExportSVG(components, strokes);
  downloadBlob(svg, 'circuit.svg', 'image/svg+xml');
}

export async function downloadPNG(components: SchematicComponent[], strokes?: Stroke[]): Promise<void> {
  const symIds = new Set(components.filter((c) => c.kicadSymbolId).map((c) => c.kicadSymbolId!));
  await Promise.all(Array.from(symIds).map(preloadSymbolSVG));
  const svg = generateExportSVG(components, strokes);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const padding = 20;
    const bounds = computeBounds(components);
    const cw = Math.max(200, Math.ceil(bounds.maxX - bounds.minX + padding * 2));
    const ch = Math.max(200, Math.ceil(bounds.maxY - bounds.minY + padding * 2));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((pngBlob) => {
      if (pngBlob) downloadBlob(pngBlob, 'circuit.png', 'image/png');
    }, 'image/png');
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

export function downloadJSON(
  strokes: Stroke[],
  components: SchematicComponent[],
  camera: { offset: { x: number; y: number }; zoom: number },
  extras?: {
    mode?: EditorMode;
    activeTool?: string;
  }
): void {
  const json = serializeState(strokes, components, camera, extras);
  downloadBlob(json, 'circuit.json', 'application/json');
}

function downloadBlob(content: string | Blob, filename: string, mimeType: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
