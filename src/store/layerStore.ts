import { create } from 'zustand';

export interface LayerDef {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
}

interface LayerState {
  layers: LayerDef[];
  activeLayerId: string;
  setActiveLayer: (id: string) => void;
  toggleVisibility: (id: string) => void;
  toggleLocked: (id: string) => void;
  reorderLayers: (ids: string[]) => void;
}

const DEFAULT_LAYERS: LayerDef[] = [
  { id: 'sketch', name: 'Sketch', visible: true, locked: false, color: '#888' },
  { id: 'components', name: 'Components', visible: true, locked: false, color: '#fff' },
  { id: 'wires', name: 'Wires', visible: true, locked: false, color: '#4fc3f7' },
  { id: 'labels', name: 'Labels', visible: true, locked: false, color: '#ffd60a' },
  { id: 'guide', name: 'Guide', visible: false, locked: true, color: '#666' },
];

export const useLayerStore = create<LayerState>((set) => ({
  layers: DEFAULT_LAYERS,
  activeLayerId: 'components',
  setActiveLayer: (id) => set({ activeLayerId: id }),
  toggleVisibility: (id) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    })),
  toggleLocked: (id) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
    })),
  reorderLayers: (ids) =>
    set((s) => ({
      layers: ids.map((id) => s.layers.find((l) => l.id === id)!).filter(Boolean),
    })),
}));
