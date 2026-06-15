import type { SchematicComponent } from '@/store/schematicStore';
import { componentTerminalDefinitions, transformPoint, computeOrthogonalPath } from '@/circuit/graph';

export function pointToSegmentDist(
  px: number, py: number, ax: number, ay: number, bx: number, by: number
): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export const TERMINAL_HIT = 14;
export const WIRE_HIT = 10;

export function hitTestTerminal(
  canvasX: number, canvasY: number,
  components: SchematicComponent[],
  excludeId?: string,
  zoom: number = 1
): { terminalId: string; componentId: string; pos: { x: number; y: number } } | null {
  const threshold = TERMINAL_HIT / zoom;
  let best = threshold;
  let result: { terminalId: string; componentId: string; pos: { x: number; y: number } } | null = null;
  for (const comp of components) {
    if (comp.id === excludeId) continue;
    const defs = componentTerminalDefinitions(comp);
    for (const def of defs) {
      const worldPt = transformPoint(def.point, comp);
      const d = Math.hypot(worldPt.x - canvasX, worldPt.y - canvasY);
      if (d < best) {
        best = d;
        result = { terminalId: `${comp.id}:${def.name}`, componentId: comp.id, pos: worldPt };
      }
    }
  }
  return result;
}

export function hitTestWire(
  canvasX: number, canvasY: number,
  components: SchematicComponent[],
  graph: { terminalMap: Record<string, { position: { x: number; y: number } }> },
  zoom: number = 1
): string | null {
  let best = WIRE_HIT / zoom;
  let bestId: string | null = null;
  for (const wire of components) {
    if (wire.type !== 'wire' || !wire.terminalA || !wire.terminalB) continue;
    const tA = graph.terminalMap[wire.terminalA];
    const tB = graph.terminalMap[wire.terminalB];
    if (!tA || !tB) continue;
    const pts = (wire.points && wire.points.length >= 2)
      ? wire.points.map((p) => ({ x: p.x, y: p.y }))
      : computeOrthogonalPath(tA.position, tB.position);
    for (let i = 0; i < pts.length - 1; i++) {
      const d = pointToSegmentDist(canvasX, canvasY, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < best) { best = d; bestId = wire.id; }
    }
  }
  return bestId;
}

function closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy };
}

export function hitTestWireSegment(
  canvasX: number, canvasY: number,
  components: SchematicComponent[],
  graph: { terminalMap: Record<string, { position: { x: number; y: number } }> },
  zoom: number = 1
): { wireId: string; segIndex: number; clickPoint: { x: number; y: number }; originalPoints: { x: number; y: number }[] } | null {
  const threshold = WIRE_HIT / zoom;
  for (const wire of components) {
    if (wire.type !== 'wire') continue;
    const pts = (wire.points && wire.points.length >= 2)
      ? wire.points.map((p) => ({ x: p.x, y: p.y }))
      : (() => {
          const tA = graph.terminalMap[wire.terminalA ?? ''];
          const tB = graph.terminalMap[wire.terminalB ?? ''];
          return (tA && tB) ? computeOrthogonalPath(tA.position, tB.position) : [];
        })();
    for (let i = 0; i < pts.length - 1; i++) {
      const d = pointToSegmentDist(canvasX, canvasY, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < threshold) {
        const clickPt = closestPointOnSegment(canvasX, canvasY, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        return { wireId: wire.id, segIndex: i, clickPoint: clickPt, originalPoints: pts };
      }
    }
  }
  return null;
}

export function hitTestBendPoint(
  canvasX: number, canvasY: number,
  components: SchematicComponent[],
  zoom: number = 1
): { wireId: string; pointIndex: number } | null {
  const threshold = 10 / zoom;
  for (const wire of components) {
    if (wire.type !== 'wire' || !wire.points || wire.points.length < 3) continue;
    for (let i = 1; i < wire.points.length - 1; i++) {
      if (Math.hypot(wire.points[i].x - canvasX, wire.points[i].y - canvasY) < threshold) {
        return { wireId: wire.id, pointIndex: i };
      }
    }
  }
  return null;
}
