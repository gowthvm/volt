import type { Stroke } from '@/store/drawingStore';
import type { SchematicComponent } from '@/store/schematicStore';

export interface SerializedEditorState {
  version: 1;
  strokes: Stroke[];
  components: SchematicComponent[];
  camera: {
    offset: { x: number; y: number };
    zoom: number;
  };
}

export function serializeState(
  strokes: Stroke[],
  components: SchematicComponent[],
  camera: { offset: { x: number; y: number }; zoom: number }
): string {
  const state: SerializedEditorState = {
    version: 1,
    strokes,
    components,
    camera,
  };
  return JSON.stringify(state);
}

export function deserializeState(json: string): SerializedEditorState | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || parsed.version !== 1) return null;
    return parsed as SerializedEditorState;
  } catch {
    return null;
  }
}
