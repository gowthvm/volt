import { create } from 'zustand';
import { simulate, type SimulationResult } from '@/circuit/simulation';
import { useSchematicStore } from './schematicStore';
import { useCircuitStore } from './circuitStore';
import { validateCircuit } from '@/circuit/validation';

interface SimulationState {
  result: SimulationResult | null;
  isRunning: boolean;
  hasRun: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  runSimulation: () => void;
  clearResults: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  result: null,
  isRunning: false,
  hasRun: false,
  validationErrors: [],
  validationWarnings: [],

  runSimulation: () => {
    const components = useSchematicStore.getState().components;
    const cs = useCircuitStore.getState();
    cs.rebuildGraph(components);

    const graph = useCircuitStore.getState().graph;
    const validation = validateCircuit(components, graph);
    set({ validationErrors: validation.errors, validationWarnings: validation.warnings });

    if (!validation.valid) {
      set({
        result: {
          success: false,
          error: validation.errors.join('; '),
          nodeVoltages: {},
          terminalNodes: {},
          componentVoltages: {},
          componentCurrents: {},
          componentPowers: {},
        },
        isRunning: false, hasRun: true,
      });
      return;
    }

    set({ isRunning: true });

    const result = simulate(components, graph);
    set({ result, isRunning: false, hasRun: true });
  },

  clearResults: () => set({ result: null, hasRun: false, validationErrors: [], validationWarnings: [] }),
}));

let simTimer: ReturnType<typeof setTimeout> | null = null;
useSchematicStore.subscribe(() => {
  if (simTimer) clearTimeout(simTimer);
  simTimer = setTimeout(() => {
    simTimer = null;
    useSimulationStore.getState().runSimulation();
  }, 300);
});

export default useSimulationStore;
