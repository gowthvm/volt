import { create } from 'zustand';
import useSchematicStore, { type SchematicComponent } from '@/store/schematicStore';
import { buildCircuitGraph, SNAP_THRESHOLD, type CircuitGraph } from '@/circuit/graph';

interface CircuitState {
  graph: CircuitGraph;
  snapThreshold: number;
  isDirty: boolean;
  rebuildGraph: (components: SchematicComponent[]) => void;
  markDirty: () => void;
  _suppressSync: boolean;
  setSuppressSync: (suppress: boolean) => void;
}

const initialGraph = buildCircuitGraph([]);

let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

export const useCircuitStore = create<CircuitState>((set) => ({
  graph: initialGraph,
  snapThreshold: SNAP_THRESHOLD,
  isDirty: true,
  _suppressSync: false,
  setSuppressSync: (suppress) => set({ _suppressSync: suppress }),
  markDirty: () => set({ isDirty: true }),
  rebuildGraph: (components) => {
    if (rebuildTimer) { clearTimeout(rebuildTimer); rebuildTimer = null; }
    const graph = buildCircuitGraph(components, SNAP_THRESHOLD);
    set({ graph, isDirty: false });
  },
}));

useSchematicStore.subscribe((state) => {
  const cs = useCircuitStore.getState();
  if (cs._suppressSync) {
    cs.markDirty();
    return;
  }
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    cs.rebuildGraph(state.components);
  }, 80);
});

export default useCircuitStore;
