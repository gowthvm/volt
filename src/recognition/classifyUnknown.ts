import type { StrokePoint } from './types';

export const classifyUnknown = (_stroke: StrokePoint[]) => ({
  type: 'unknown' as const,
  confidence: 0.1,
});
