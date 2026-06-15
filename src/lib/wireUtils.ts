import { computeOrthogonalPath, computeObstacleAvoidingPath, type BoundingBox } from '@/circuit/graph';

export const GRID_SNAP = 24;

export const snapToGrid = (v: number) => (Math.sign(v) * Math.round(Math.abs(v) / GRID_SNAP) * GRID_SNAP) || 0;

export const flattenWirePath = (
  waypoints: { x: number; y: number }[],
  bendOrientations?: boolean[],
  obstacles?: BoundingBox[]
): { x: number; y: number }[] => {
  if (waypoints.length < 2) return [...waypoints];
  const result: { x: number; y: number }[] = [{ x: waypoints[0].x, y: waypoints[0].y }];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx < 2 && dy < 2) {
      if (a.x !== b.x || a.y !== b.y) result.push({ x: b.x, y: b.y });
      continue;
    }
    if (dx < 2 || dy < 2) {
      result.push({ x: b.x, y: b.y });
      continue;
    }
    if (obstacles && obstacles.length > 0) {
      const obsPath = computeObstacleAvoidingPath(a, b, obstacles, bendOrientations ? bendOrientations[i] : true);
      for (let j = 1; j < obsPath.length; j++) result.push(obsPath[j]);
    } else {
      const hFirst = bendOrientations ? bendOrientations[i] : true;
      if (hFirst) {
        result.push({ x: b.x, y: a.y });
      } else {
        result.push({ x: a.x, y: b.y });
      }
      result.push({ x: b.x, y: b.y });
    }
  }
  return result;
};

export function moveBendPointInPath(
  pts: { x: number; y: number }[],
  idx: number,
  newPos: { x: number; y: number }
): { result: { x: number; y: number }[]; newIdx: number } {
  if (idx <= 0 || idx >= pts.length - 1) return { result: pts, newIdx: idx };
  const orthoLeft = computeOrthogonalPath(pts[idx - 1], newPos);
  const orthoRight = computeOrthogonalPath(newPos, pts[idx + 1]);
  const result: { x: number; y: number }[] = [
    ...pts.slice(0, idx), ...orthoLeft.slice(1), ...orthoRight.slice(1), ...pts.slice(idx + 2),
  ];
  return { result, newIdx: idx + orthoLeft.length - 2 };
}

export function updateWireEndpoint(
  pts: { x: number; y: number }[],
  isStart: boolean,
  newPos: { x: number; y: number }
): { x: number; y: number }[] {
  if (pts.length < 2) return pts;
  const n = pts.length;
  if (isStart) {
    const anchor = n >= 3 ? pts[2] : pts[1];
    const ortho = computeOrthogonalPath(newPos, anchor);
    const result = [...ortho];
    if (n >= 3) result.push(...pts.slice(3));
    return result;
  }
  const anchor = n >= 3 ? pts[n - 3] : pts[n - 2];
  const ortho = computeOrthogonalPath(anchor, newPos);
  if (n >= 3) return [...pts.slice(0, n - 3), ...ortho];
  return [...ortho];
}

export function dedupPoints(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length <= 1) return pts;
  const result: { x: number; y: number }[] = [{ x: pts[0].x, y: pts[0].y }];
  for (let i = 1; i < pts.length; i++) {
    const last = result[result.length - 1];
    if (Math.hypot(pts[i].x - last.x, pts[i].y - last.y) > 1) result.push({ x: pts[i].x, y: pts[i].y });
  }
  return result;
}
