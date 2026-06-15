import type { StrokeMetrics, StrokePoint } from './types';

const normalizeAngle = (angle: number) => {
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const distance = (a: StrokePoint, b: StrokePoint) => Math.hypot(b.x - a.x, b.y - a.y);

const projectPointOnSegment = (p: StrokePoint, a: StrokePoint, b: StrokePoint) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return a;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + dx * t, y: a.y + dy * t };
};

export const analyzeStroke = (points: StrokePoint[]): StrokeMetrics => {
  const pointCount = points.length;
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const aspectRatio = width / height >= 1 ? width / height : height / width;

  let length = 0;
  const angles: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    length += distance(a, b);
    angles.push(Math.atan2(b.y - a.y, b.x - a.x));
  }

  const start = points[0];
  const end = points[points.length - 1];
  const startEndDistance = distance(start, end);
  const linearity = length > 0 ? startEndDistance / length : 0;
  const meanSegmentLength = pointCount > 1 ? length / (pointCount - 1) : 0;

  let totalTurnAngle = 0;
  let directionChangeCount = 0;
  let zigzagChanges = 0;
  let sharpTurnCount = 0;
  let lastSign = 0;
  let lastAngle = angles[0] ?? 0;

  for (let i = 1; i < angles.length; i += 1) {
    const rawDelta = normalizeAngle(angles[i] - lastAngle);
    const delta = Math.abs(rawDelta);
    totalTurnAngle += delta;

    const sign = Math.sign(rawDelta);
    if (delta > Math.PI * 0.35) {
      sharpTurnCount += 1;
    }
    if (sign !== 0 && lastSign !== 0 && sign !== lastSign && delta > Math.PI * 0.15) {
      zigzagChanges += 1;
    }
    if (delta > Math.PI * 0.2) {
      directionChangeCount += 1;
    }
    if (sign !== 0) {
      lastSign = sign;
    }
    lastAngle = angles[i];
  }

  const averageTurnAngle = angles.length > 1 ? totalTurnAngle / (angles.length - 1) : 0;
  const curvature = length > 0 ? totalTurnAngle / length : 0;
  const zigzagFrequency = length > 0 ? zigzagChanges / length : 0;
  const turnDensity = length > 0 ? totalTurnAngle / length : 0;

  const diag = Math.hypot(width, height);
  let lineDistanceSum = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const projected = projectPointOnSegment(points[i], start, end);
    lineDistanceSum += distance(points[i], projected);
  }
  const pathDeviation = Math.max(0, diag > 0 ? lineDistanceSum / Math.max(1, points.length - 2) / diag : 0);

  const dominantAngle = Math.atan2(end.y - start.y, end.x - start.x);
  const absDominant = Math.abs(normalizeAngle(dominantAngle));
  const isMostlyHorizontal = absDominant < Math.PI * 0.25 || absDominant > Math.PI * 0.75;
  const isMostlyVertical = !isMostlyHorizontal;

  return {
    pointCount,
    length,
    boundingBox: { minX, minY, maxX, maxY, width, height, aspectRatio },
    linearity,
    meanSegmentLength,
    totalTurnAngle,
    averageTurnAngle,
    curvature,
    directionChangeCount,
    zigzagFrequency,
    sharpTurnCount,
    turnDensity,
    pathDeviation,
    dominantAngle,
    isMostlyHorizontal,
    isMostlyVertical,
  };
};

export const getRecognitionPose = (metrics: StrokeMetrics) => {
  const { boundingBox, dominantAngle } = metrics;
  return {
    position: {
      x: boundingBox.minX + boundingBox.width / 2,
      y: boundingBox.minY + boundingBox.height / 2,
    },
    rotation: dominantAngle,
    scale: {
      x: boundingBox.width / 100,
      y: boundingBox.height / 100,
    },
  };
};

export const score = (value: number, min: number, max: number) => {
  return clamp((value - min) / (max - min), 0, 1);
};
