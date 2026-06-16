import type { Stroke } from '@/store/drawingStore';
import type { SchematicComponent } from '@/store/schematicStore';
import type { EditorMode } from '@/store/editorModeStore';

export interface SerializedEditorState {
  version: 2;
  strokes: Stroke[];
  components: SchematicComponent[];
  camera: {
    offset: { x: number; y: number };
    zoom: number;
  };
  mode?: EditorMode;
  activeTool?: string;
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  multiSelectedComponentIds?: string[];
  multiSelectedWireIds?: string[];
  selectedComponentId?: string | null;
  selectedWireId?: string | null;
}

export function serializeState(
  strokes: Stroke[],
  components: SchematicComponent[],
  camera: { offset: { x: number; y: number }; zoom: number },
  extras?: {
    mode?: EditorMode;
    activeTool?: string;
    leftPanelOpen?: boolean;
    rightPanelOpen?: boolean;
    multiSelectedComponentIds?: string[];
    multiSelectedWireIds?: string[];
    selectedComponentId?: string | null;
    selectedWireId?: string | null;
  }
): string {
  const state: SerializedEditorState = {
    version: 2,
    strokes,
    components,
    camera,
    ...extras,
  };
  return JSON.stringify(state);
}

export function deserializeState(json: string): SerializedEditorState | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed) return null;
    if (parsed.version === 1) {
      return {
        ...parsed,
        version: 2,
      } as SerializedEditorState;
    }
    if (parsed.version !== 2) return null;
    return parsed as SerializedEditorState;
  } catch {
    return null;
  }
}
