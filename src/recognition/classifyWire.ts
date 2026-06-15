import type { StrokePoint } from './types';
import { analyzeStroke, score } from './utils';

export const classifyWire = (stroke: StrokePoint[]) => {
  const metrics = analyzeStroke(stroke);
  const straightness = score(metrics.linearity, 0.88, 1);
  const smoothness = score(0.16 - metrics.pathDeviation, 0, 0.16);
  const flatRatio = score(metrics.boundingBox.aspectRatio, 1.6, 6);
  const lowTurmoil = score(0.12 - metrics.zigzagFrequency, 0, 0.12);
  const lengthScore = score(metrics.length, 50, 240);
  const confidence = Math.min(1, (straightness * 0.45 + smoothness * 0.25 + flatRatio * 0.15 + lowTurmoil * 0.15) * lengthScore);
  return { type: 'wire' as const, confidence };
};
