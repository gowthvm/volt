export type StrokePoint = { x: number; y: number; pressure?: number };

export type ComponentType = 'wire' | 'unknown';

export interface RecognitionResult {
  type: ComponentType;
  confidence: number;
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
}

export interface StrokeMetrics {
  pointCount: number;
  length: number;
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    aspectRatio: number;
  };
  linearity: number;
  meanSegmentLength: number;
  totalTurnAngle: number;
  averageTurnAngle: number;
  curvature: number;
  directionChangeCount: number;
  zigzagFrequency: number;
  sharpTurnCount: number;
  turnDensity: number;
  pathDeviation: number;
  dominantAngle: number;
  isMostlyHorizontal: boolean;
  isMostlyVertical: boolean;
}
