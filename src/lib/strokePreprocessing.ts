export interface StrokePoint {
  x: number;
  y: number;
}

export interface ProcessedStroke {
  originalStrokeId: string;
  simplifiedPoints: StrokePoint[];
  normalizedPoints: StrokePoint[];
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  aspectRatio: number;
  length: number;
  directionChanges: number;
  averageCurvature: number;
  closed: boolean;
  startPoint: StrokePoint;
  endPoint: StrokePoint;
}

export interface Connection {
  fromStrokeIndex: number;
  toStrokeIndex: number;
  distance: number;
}

export interface PreprocessedResult {
  strokes: ProcessedStroke[];
  connections: Connection[];
  originalBounds: { minX: number; minY: number; maxX: number; maxY: number };
  normalizedText: string;
}

function perpendicularDistance(
  point: StrokePoint,
  lineStart: StrokePoint,
  lineEnd: StrokePoint
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

export function ramerDouglasPeucker(
  points: StrokePoint[],
  epsilon: number
): StrokePoint[] {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > dmax) {
      dmax = d;
      index = i;
    }
  }
  if (dmax > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

export function computeBoundingBox(points: StrokePoint[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function normalizeStrokes(strokes: ProcessedStroke[]): ProcessedStroke[] {
  const allPoints: StrokePoint[] = [];
  for (const s of strokes) {
    allPoints.push(...s.simplifiedPoints);
  }
  const bounds = computeBoundingBox(allPoints);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);

  return strokes.map((stroke) => {
    const normalizedPoints = stroke.simplifiedPoints.map((p) => ({
      x: ((p.x - bounds.minX) / width) * 100,
      y: ((p.y - bounds.minY) / height) * 100,
    }));
    const bb = computeBoundingBox(normalizedPoints);
    const bbW = Math.max(0.01, bb.maxX - bb.minX);
    const bbH = Math.max(0.01, bb.maxY - bb.minY);
    const aspectRatio = bbW / bbH >= 1 ? bbW / bbH : bbH / bbW;
    const length = computePathLength(normalizedPoints);
    const directionChanges = countDirectionChanges(normalizedPoints);
    const averageCurvature = computeAverageCurvature(normalizedPoints);
    const startEndDist = Math.hypot(
      normalizedPoints[0].x - normalizedPoints[normalizedPoints.length - 1].x,
      normalizedPoints[0].y - normalizedPoints[normalizedPoints.length - 1].y
    );
    const closed = startEndDist < 5;

    return {
      ...stroke,
      normalizedPoints,
      boundingBox: bb,
      aspectRatio,
      length,
      directionChanges,
      averageCurvature,
      closed,
      startPoint: normalizedPoints[0],
      endPoint: normalizedPoints[normalizedPoints.length - 1],
    };
  });
}

function computePathLength(points: StrokePoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function countDirectionChanges(points: StrokePoint[]): number {
  if (points.length < 3) return 0;
  let changes = 0;
  let lastAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  for (let i = 2; i < points.length; i++) {
    const angle = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
    let delta = angle - lastAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) > 0.35) changes++;
    lastAngle = angle;
  }
  return changes;
}

function computeAverageCurvature(points: StrokePoint[]): number {
  if (points.length < 3) return 0;
  let totalCurvature = 0;
  let count = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const b = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    const c = Math.hypot(points[i + 1].x - points[i - 1].x, points[i + 1].y - points[i - 1].y);
    if (a > 0 && b > 0) {
      const angle = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b))));
      totalCurvature += angle;
      count++;
    }
  }
  return count > 0 ? totalCurvature / count : 0;
}

export function detectConnections(strokes: ProcessedStroke[]): Connection[] {
  const connections: Connection[] = [];
  for (let i = 0; i < strokes.length; i++) {
    for (let j = i + 1; j < strokes.length; j++) {
      const ends = [
        { idx: i, pt: strokes[i].endPoint },
        { idx: i, pt: strokes[i].startPoint },
        { idx: j, pt: strokes[j].startPoint },
        { idx: j, pt: strokes[j].endPoint },
      ];
      for (let a = 0; a < 2; a++) {
        for (let b = 2; b < 4; b++) {
          const d = Math.hypot(ends[a].pt.x - ends[b].pt.x, ends[a].pt.y - ends[b].pt.y);
          if (d <= 5) {
            connections.push({
              fromStrokeIndex: ends[a].idx,
              toStrokeIndex: ends[b].idx,
              distance: Math.round(d * 10) / 10,
            });
          }
        }
      }
    }
  }
  return connections;
}

export function formatStrokesAsText(result: PreprocessedResult): string {
  const lines: string[] = [];
  lines.push('CIRCUIT SKETCH DATA');
  lines.push('Canvas: 100x100 normalized units');
  lines.push(`Total strokes: ${result.strokes.length}`);
  lines.push('');

  result.strokes.forEach((s, i) => {
    const ptsStr = s.normalizedPoints.map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`).join(',');
    lines.push(`Stroke ${i + 1}:`);
    lines.push(`  Points: [${ptsStr}]`);
    lines.push(
      `  Bounding box: x=${Math.round(s.boundingBox.minX)}-${Math.round(s.boundingBox.maxX)}, y=${Math.round(s.boundingBox.minY)}-${Math.round(s.boundingBox.maxY)}`
    );
    const isHorizontal = s.boundingBox.maxY - s.boundingBox.minY < 5;
    const ratioStr = isHorizontal
      ? 'flat horizontal line'
      : `${s.aspectRatio.toFixed(1)} (${s.aspectRatio > 1.5 ? 'wide' : 'narrow'})`;
    lines.push(`  Aspect ratio: ${ratioStr}`);
    lines.push(`  Direction changes: ${s.directionChanges}`);
    lines.push(`  Length: ${Math.round(s.length)}`);
    lines.push(`  Closed: ${s.closed ? 'yes' : 'no'}`);
    lines.push(`  Start: (${Math.round(s.startPoint.x)},${Math.round(s.startPoint.y)}) End: (${Math.round(s.endPoint.x)},${Math.round(s.endPoint.y)})`);
    lines.push('');
  });

  if (result.connections.length > 0) {
    lines.push('Connections detected:');
    for (const c of result.connections) {
      lines.push(`  Stroke ${c.fromStrokeIndex + 1} → Stroke ${c.toStrokeIndex + 1} (distance: ${c.distance})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function preprocessStrokes(
  rawPointsArray: { id: string; points: StrokePoint[] }[]
): PreprocessedResult {
  const processed: ProcessedStroke[] = rawPointsArray.map((item) => {
    const simplified = ramerDouglasPeucker(item.points, 2);
    const capped = simplified.length > 20
      ? simplified.filter((_, i) => i % Math.ceil(simplified.length / 20) === 0).slice(0, 20)
      : simplified;
    const bb = computeBoundingBox(capped);
    const bbW = Math.max(0.01, bb.maxX - bb.minX);
    const bbH = Math.max(0.01, bb.maxY - bb.minY);
    const aspectRatio = bbW / bbH >= 1 ? bbW / bbH : bbH / bbW;
    const length = computePathLength(capped);
    const directionChanges = countDirectionChanges(capped);
    const averageCurvature = computeAverageCurvature(capped);
    const startEndDist = Math.hypot(
      capped[0].x - capped[capped.length - 1].x,
      capped[0].y - capped[capped.length - 1].y
    );

    return {
      originalStrokeId: item.id,
      simplifiedPoints: capped,
      normalizedPoints: [],
      boundingBox: bb,
      aspectRatio,
      length,
      directionChanges,
      averageCurvature,
      closed: startEndDist < 5,
      startPoint: capped[0],
      endPoint: capped[capped.length - 1],
    };
  });

  const allPoints: StrokePoint[] = [];
  for (const s of processed) {
    allPoints.push(...s.simplifiedPoints);
  }
  const originalBounds = computeBoundingBox(allPoints);

  const normalized = normalizeStrokes(processed);
  const connections = detectConnections(normalized);
  const normalizedText = formatStrokesAsText({
    strokes: normalized,
    connections,
    originalBounds,
    normalizedText: '',
  });

  return {
    strokes: normalized,
    connections,
    originalBounds,
    normalizedText,
  };
}

export function denormalizePosition(
  normalizedPos: { x: number; y: number },
  originalBounds: { minX: number; minY: number; maxX: number; maxY: number }
): { x: number; y: number } {
  const width = Math.max(1, originalBounds.maxX - originalBounds.minX);
  const height = Math.max(1, originalBounds.maxY - originalBounds.minY);
  return {
    x: originalBounds.minX + (normalizedPos.x / 100) * width,
    y: originalBounds.minY + (normalizedPos.y / 100) * height,
  };
}
