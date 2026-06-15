import { create } from 'zustand';

export type StrokePoint = { x: number; y: number; pressure?: number };

export type StrokeTool = 'select' | 'pen' | 'eraser' | 'wire' | 'pan';

export interface Stroke {
  id: string;
  tool: StrokeTool;
  color?: string;
  width: number;
  points: StrokePoint[];
}

type Action =
  | { type: 'add'; stroke: Stroke }
  | { type: 'remove'; stroke: Stroke };

interface DrawingState {
  strokes: Stroke[];
  tool: StrokeTool;
  sketchMode: boolean;
  setTool: (tool: StrokeTool) => void;
  setSketchMode: (v: boolean) => void;
  addStroke: (stroke: Omit<Stroke, 'id'>) => string;
  removeStrokeById: (id: string) => void;
  eraseByPath: (path: StrokePoint[], radius: number) => string[]; // returns removed ids
  loadStrokes: (strokes: Stroke[]) => void;
  undo: () => void;
  redo: () => void;
}

export const useDrawingStore = create<DrawingState>((set, get) => {
  const history: Action[] = [];
  const future: Action[] = [];

  const pushHistory = (action: Action) => {
    history.push(action);
    // clear future on new action
    future.length = 0;
  };

  return {
    strokes: [],
    tool: 'pen',
    sketchMode: false,
    setTool: (tool) => set({ tool }),
    setSketchMode: (v) => set({ sketchMode: v }),
    addStroke: (s) => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const stroke: Stroke = { id, ...s } as Stroke;
      set((st) => ({ strokes: [...st.strokes, stroke] }));
      pushHistory({ type: 'add', stroke });
      return id;
    },
    removeStrokeById: (id) => {
      const st = get().strokes.find((s) => s.id === id);
      if (!st) return;
      set((state) => ({ strokes: state.strokes.filter((s) => s.id !== id) }));
      pushHistory({ type: 'remove', stroke: st });
    },
    eraseByPath: (path, radius) => {
      const toRemove: Stroke[] = [];
      const strokes = get().strokes;
      for (const s of strokes) {
        for (const p of s.points) {
          for (const e of path) {
            const dx = p.x - e.x;
            const dy = p.y - e.y;
            if (dx * dx + dy * dy <= radius * radius) {
              toRemove.push(s);
              break;
            }
          }
          if (toRemove.includes(s)) break;
        }
      }
      const removedIds: string[] = [];
      if (toRemove.length) {
        set((state) => ({ strokes: state.strokes.filter((s) => !toRemove.includes(s)) }));
        for (const r of toRemove) {
          pushHistory({ type: 'remove', stroke: r });
          removedIds.push(r.id);
        }
      }
      return removedIds;
    },
    loadStrokes: (newStrokes: Stroke[]) => {
    set({ strokes: newStrokes });
    history.length = 0;
    future.length = 0;
  },
  undo: () => {
      const action = history.pop();
      if (!action) return;
      if (action.type === 'add') {
        set((state) => ({ strokes: state.strokes.filter((s) => s.id !== action.stroke.id) }));
        future.push(action);
      } else if (action.type === 'remove') {
        set((state) => ({ strokes: [...state.strokes, action.stroke] }));
        future.push(action);
      }
    },
    redo: () => {
      const action = future.pop();
      if (!action) return;
      if (action.type === 'add') {
        set((state) => ({ strokes: [...state.strokes, action.stroke] }));
        history.push(action);
      } else if (action.type === 'remove') {
        set((state) => ({ strokes: state.strokes.filter((s) => s.id !== action.stroke.id) }));
        history.push(action);
      }
    },
  };
});

export default useDrawingStore;
