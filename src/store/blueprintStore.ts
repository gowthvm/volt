import { create } from 'zustand';

export type BlueprintTool = 'pen' | 'line' | 'rect' | 'circle' | 'eraser' | 'text' | 'pan';

export interface PenStroke {
  id: string;
  type: 'pen';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

export interface LinePrimitive {
  id: string;
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
}

export interface RectPrimitive {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  rectW: number;
  rectH: number;
  color: string;
  strokeWidth: number;
}

export interface CirclePrimitive {
  id: string;
  type: 'circle';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  strokeWidth: number;
}

export interface TextPrimitive {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export type BlueprintPrimitive = PenStroke | LinePrimitive | RectPrimitive | CirclePrimitive | TextPrimitive;

export const STROKE_COLORS = ['#ffffff', '#ffd60a', '#ef4444', '#22c55e', '#3b82f6', '#6b7280'] as const;
export const STROKE_WIDTHS = [2, 4, 8] as const; // thin, medium, thick

interface BlueprintState {
  primitives: BlueprintPrimitive[];
  tool: BlueprintTool;
  color: string;
  width: number;
  camera: { x: number; y: number; zoom: number };
  referenceImage: string | null;
  undoStack: BlueprintPrimitive[][];
  redoStack: BlueprintPrimitive[][];

  addPrimitive: (p: BlueprintPrimitive) => void;
  removePrimitive: (id: string) => void;
  clearAll: () => void;
  setTool: (t: BlueprintTool) => void;
  setColor: (c: string) => void;
  setWidth: (w: number) => void;
  setCamera: (c: { x: number; y: number; zoom: number }) => void;
  setReferenceImage: (url: string | null) => void;
  pushUndoState: () => void;
  undo: () => void;
  redo: () => void;
}

let _idCounter = 0;
function uid(): string {
  return 'bp_' + (++_idCounter).toString(36);
}

const useBlueprintStore = create<BlueprintState>((set, get) => ({
  primitives: [],
  tool: 'pen',
  color: '#ffffff',
  width: 4,
  camera: { x: 0, y: 0, zoom: 1 },
  referenceImage: null,
  undoStack: [],
  redoStack: [],

  addPrimitive: (p) => {
    const prim = { ...p, id: p.id || uid() };
    set((s) => ({ primitives: [...s.primitives, prim], redoStack: [] }));
  },

  removePrimitive: (id) => {
    set((s) => ({ primitives: s.primitives.filter((p) => p.id !== id) }));
  },

  clearAll: () => {
    set({ primitives: [], referenceImage: null, redoStack: [] });
  },

  setTool: (t) => set({ tool: t }),
  setColor: (c) => set({ color: c }),
  setWidth: (w) => set({ width: w }),

  setCamera: (c) => set({ camera: c }),

  setReferenceImage: (url) => set({ referenceImage: url }),

  pushUndoState: () => {
    const { primitives } = get();
    set((s) => ({
      undoStack: [...s.undoStack.slice(-99), [...primitives.map((p) => ({ ...p }))]],
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack, primitives } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, [...primitives.map((p) => ({ ...p }))]],
      primitives: prev,
    });
  },

  redo: () => {
    const { redoStack, primitives } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, [...primitives.map((p) => ({ ...p }))]],
      primitives: next,
    });
  },
}));

export default useBlueprintStore;
