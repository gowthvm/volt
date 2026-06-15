import { create } from 'zustand';

interface CanvasOffset {
  x: number;
  y: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

interface CanvasState {
  offset: CanvasOffset;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  spacePan: boolean;
  canvasSize: CanvasSize;
  setSpacePan: (v: boolean) => void;
  setCanvasSize: (size: CanvasSize) => void;
  setOffset: (offset: CanvasOffset) => void;
  setZoom: (zoom: number) => void;
  setCamera: (offset: CanvasOffset, zoom: number) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  offset: { x: 0, y: 0 },
  zoom: 1,
  minZoom: 0.25,
  maxZoom: 4,
  spacePan: false,
  canvasSize: { width: 0, height: 0 },
  setSpacePan: (v) => set({ spacePan: v }),
  setCanvasSize: (size) => set({ canvasSize: size }),
  setOffset: (offset) => set({ offset }),
  setZoom: (zoom) => set({ zoom }),
  setCamera: (offset, zoom) => set({ offset, zoom }),
}));
