import type { RecognitionResult, StrokePoint } from './types';
import { analyzeStroke, getRecognitionPose } from './utils';
import { classifyWire } from './classifyWire';
import { classifyUnknown } from './classifyUnknown';

export const recognizeStroke = (stroke: StrokePoint[]): RecognitionResult => {
  const metrics = analyzeStroke(stroke);
  const wire = classifyWire(stroke);
  const chosen = wire.confidence >= 0.45 ? wire : classifyUnknown(stroke);
  return {
    ...chosen,
    ...getRecognitionPose(metrics),
  };
};
