import { create } from 'zustand';

export interface RecognizedComponent {
  type: string;
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
  value?: number;
  kicadSymbolId?: string;
  confidence: number;
  strokeIndices?: number[];
}

interface RecognitionState {
  isRecognizing: boolean;
  recognitionResult: RecognizedComponent[] | null;
  panelOpen: boolean;
  error: string | null;
  unrecognizedStrokeIndices: number[];
  rawAiOutput: string | null;

  setRecognizing: (v: boolean) => void;
  setResult: (r: RecognizedComponent[] | null) => void;
  setUnrecognized: (indices: number[]) => void;
  setRawOutput: (raw: string | null) => void;
  togglePanel: () => void;
  closePanel: () => void;
  setError: (msg: string | null) => void;
  clearAll: () => void;
}

export const useRecognitionStore = create<RecognitionState>((set) => ({
  isRecognizing: false,
  recognitionResult: null,
  panelOpen: false,
  error: null,
  unrecognizedStrokeIndices: [],
  rawAiOutput: null,

  setRecognizing: (v) => set({ isRecognizing: v }),
  setResult: (r) => set({ recognitionResult: r, error: null }),
  setUnrecognized: (indices) => set({ unrecognizedStrokeIndices: indices }),
  setRawOutput: (raw) => set({ rawAiOutput: raw }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  closePanel: () => set({ panelOpen: false }),
  setError: (msg) => set({ error: msg }),
  clearAll: () =>
    set({
      recognitionResult: null,
      error: null,
      unrecognizedStrokeIndices: [],
      rawAiOutput: null,
      panelOpen: false,
    }),
}));
