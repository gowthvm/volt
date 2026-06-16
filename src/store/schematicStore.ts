import { create } from 'zustand';
import type { ComponentType, StrokePoint } from '@/recognition/types';
import { useHistoryStore } from '@/store/historyStore';
import { useLayerStore } from '@/store/layerStore';

export interface KicadPinDef {
  name: string;
  number: string;
  x: number;
  y: number;
  length: number;
  orientation: number;
  electricalType: string;
}

export interface NormalizedPinPos {
  name: string;
  number: string;
  x: number;
  y: number;
}

export interface SchematicComponent {
  id: string;
  type: ComponentType;
  confidence: number;
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
  points?: StrokePoint[];
  value?: number;
  terminalA?: string;
  terminalB?: string;
  params?: Record<string, number | string | boolean>;
  kicadSymbolId?: string;
  kicadPins?: KicadPinDef[];
  normalizedPinPositions?: NormalizedPinPos[];
  symbolViewBox?: { w: number; h: number };
  layer?: string;
  refdes?: string;
}

export interface Snapshot {
  components: SchematicComponent[];
  selectedComponentId: string | null;
  selectedWireId: string | null;
}

let _snapshotPending = false;

export function pushSnapshotHistory(label: string, before: Snapshot, after: Snapshot) {
  useHistoryStore.getState().push({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    execute: () => {
      useSchematicStore.getState().loadComponents(after.components);
    },
    undo: () => {
      useSchematicStore.getState().loadComponents(before.components);
    },
  });
}

function snapRotation(r: number): number {
  if (!isFinite(r)) return 0;
  const deg = ((r * 180) / Math.PI) % 360;
  const normalized = ((deg % 360) + 360) % 360;
  const snapped = Math.round(normalized / 90) * 90;
  return (snapped * Math.PI) / 180;
}

export function isCompLocked(comp: { layer?: string } | undefined): boolean {
  if (!comp?.layer) return false;
  const layer = useLayerStore.getState().layers.find((l) => l.id === comp.layer);
  return layer?.locked ?? false;
}

export function generateRefdes(type: string, kicadSymbolId: string | undefined, counters: Record<string, number>): string {
  const symId = kicadSymbolId ?? '';
  const shortId = symId.includes(':') ? symId.split(':')[1] : symId;
  const s = shortId.toUpperCase();
  const full = symId.toUpperCase();
  let prefix = 'U';
  if (type === 'wire') prefix = 'W';
  else if (s === 'R' || full.includes('R_')) prefix = 'R';
  else if (s === 'C' || full.includes('C_') || full.includes('CAPACITOR')) prefix = 'C';
  else if (s === 'L' || full.includes('L_') || full.includes('INDUCTOR')) prefix = 'L';
  else if (s === 'D' || full.includes('D_') || full.includes('DIODE') || full.includes('LED')) prefix = 'D';
  else if (s === 'GND' || s.startsWith('GND') || full.includes('GROUND')) prefix = 'GND';
  else if (full.includes('Q_') || full.includes('TRANSISTOR')) prefix = 'Q';
  else if (full.includes('SW_') || full.includes('SWITCH')) prefix = 'S';
  else if (full.includes('BATTERY') || full.includes('BAT')) prefix = 'B';
  const key = prefix;
  counters[key] = (counters[key] ?? 0) + 1;
  return `${prefix}${counters[key]}`;
}

interface SchematicState {
  components: SchematicComponent[];
  selectedComponentId: string | null;
  selectedWireId: string | null;
  multiSelectedComponentIds: string[];
  multiSelectedWireIds: string[];
  hoveredTerminalId: string | null;
  isDirty: boolean;
  refdesCounters: Record<string, number>;
  addComponent: (component: Omit<SchematicComponent, 'id'>) => string;
  removeComponentById: (id: string) => void;
  removeComponentsByIds: (ids: string[]) => void;
  updateComponent: (id: string, partial: Partial<Omit<SchematicComponent, 'id'>>) => void;
  updateComponentValue: (id: string, value: number | undefined) => void;
  updateComponentPosition: (id: string, position: { x: number; y: number }) => void;
  rotateComponent: (id: string, rotation?: number) => void;
  setSelectedComponentId: (id: string | null) => void;
  setSelectedWireId: (id: string | null) => void;
  setSelection: (componentIds: string[], wireIds: string[]) => void;
  clearMultiSelection: () => void;
  setHoveredTerminalId: (id: string | null) => void;
  clearSelection: () => void;
  clearComponents: () => void;
  loadComponents: (components: SchematicComponent[]) => void;
  setDirty: (d: boolean) => void;
  undo: () => void;
  redo: () => void;
  /** Capture full state snapshot */
  captureSnapshot: () => Snapshot;
}

export const useSchematicStore = create<SchematicState>((set, get) => {
  return {
    components: [],
    selectedComponentId: null,
    selectedWireId: null,
    multiSelectedComponentIds: [],
    multiSelectedWireIds: [],
    hoveredTerminalId: null,
    isDirty: false,
    refdesCounters: {},

    captureSnapshot: () => {
      const state = get();
      return {
        components: JSON.parse(JSON.stringify(state.components)),
        selectedComponentId: state.selectedComponentId,
        selectedWireId: state.selectedWireId,
      };
    },

    addComponent: (component) => {
      const before = get().captureSnapshot();
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const activeLayer = useLayerStore.getState().activeLayerId;
      const counters = { ...get().refdesCounters };
      const refdes = generateRefdes(component.type ?? 'unknown', component.kicadSymbolId, counters);
      const schematic: SchematicComponent = { id, layer: activeLayer, refdes, ...component } as SchematicComponent;
      set((state) => ({ components: [...state.components, schematic], refdesCounters: counters, isDirty: true }));
      const after = get().captureSnapshot();
      pushSnapshotHistory('Place component', before, after);
      return id;
    },

    removeComponentById: (id) => {
      const before = get().captureSnapshot();
      const comp = get().components.find((c) => c.id === id);
      if (comp?.layer) {
        const layer = useLayerStore.getState().layers.find((l) => l.id === comp.layer);
        if (layer?.locked) return;
      }
      // Remove wires whose terminal references point to the deleted component
      const wireIdsToRemove = get().components
        .filter((c) => c.type === 'wire' && (c.terminalA?.startsWith(id + ':') || c.terminalB?.startsWith(id + ':')))
        .map((c) => c.id);
      const removeIds = new Set([id, ...wireIdsToRemove]);
      set((state) => ({
        components: state.components.filter((c) => !removeIds.has(c.id)),
        selectedComponentId: state.selectedComponentId && removeIds.has(state.selectedComponentId) ? null : state.selectedComponentId,
        selectedWireId: state.selectedWireId && removeIds.has(state.selectedWireId) ? null : state.selectedWireId,
        multiSelectedComponentIds: state.multiSelectedComponentIds.filter((did) => !removeIds.has(did)),
        multiSelectedWireIds: state.multiSelectedWireIds.filter((did) => !removeIds.has(did)),
        isDirty: true,
      }));
      const after = get().captureSnapshot();
      pushSnapshotHistory('Delete component' + (wireIdsToRemove.length > 0 ? ' and wires' : ''), before, after);
    },

    removeComponentsByIds: (ids) => {
      const before = get().captureSnapshot();
      const idSet = new Set(ids);
      // Also remove wires that reference any deleted component terminals
      const extraWireIds = get().components
        .filter((c) => c.type === 'wire' && ids.some((did) => c.terminalA?.startsWith(did + ':') || c.terminalB?.startsWith(did + ':')))
        .map((c) => c.id);
      extraWireIds.forEach((wid) => idSet.add(wid));
      set((state) => ({
        components: state.components.filter((c) => !idSet.has(c.id)),
        selectedComponentId:
          state.selectedComponentId && idSet.has(state.selectedComponentId) ? null : state.selectedComponentId,
        selectedWireId:
          state.selectedWireId && idSet.has(state.selectedWireId) ? null : state.selectedWireId,
        multiSelectedComponentIds: state.multiSelectedComponentIds.filter((id) => !idSet.has(id)),
        multiSelectedWireIds: state.multiSelectedWireIds.filter((id) => !idSet.has(id)),
        isDirty: true,
      }));
      const after = get().captureSnapshot();
      pushSnapshotHistory(ids.length > 1 ? 'Delete components' : 'Delete component', before, after);
    },

    updateComponentValue: (id, value) => {
      const before = get().captureSnapshot();
      set((state) => ({
        components: state.components.map((c) => (c.id === id ? { ...c, value } : c)),
        isDirty: true,
      }));
      const after = get().captureSnapshot();
      pushSnapshotHistory('Edit value', before, after);
    },

    updateComponent: (id, partial) => {
      if (isCompLocked(get().components.find((c) => c.id === id))) return;
      const before = get().captureSnapshot();
      set((state) => ({
        components: state.components.map((c) => (c.id === id ? { ...c, ...partial } : c)),
        isDirty: true,
      }));
      const after = get().captureSnapshot();
      pushSnapshotHistory('Edit component', before, after);
    },

    updateComponentPosition: (id, position) => {
      if (isCompLocked(get().components.find((c) => c.id === id))) return;
      const before = get().captureSnapshot();
      set((state) => ({
        components: state.components.map((c) => (c.id === id ? { ...c, position } : c)),
        isDirty: true,
      }));
      const after = get().captureSnapshot();
      pushSnapshotHistory('Move component', before, after);
    },

    rotateComponent: (id, rotation) => {
      if (isCompLocked(get().components.find((c) => c.id === id))) return;
      const before = get().captureSnapshot();
      set((state) => ({
        components: state.components.map((c) =>
          c.id === id
            ? {
                ...c,
                rotation: rotation !== undefined
                  ? snapRotation(rotation)
                  : snapRotation(c.rotation + Math.PI / 2),
              }
            : c
        ),
      }));
      const after = get().captureSnapshot();
      pushSnapshotHistory('Rotate component', before, after);
    },

    setSelectedComponentId: (id) => set({ selectedComponentId: id, selectedWireId: null }),

    setSelectedWireId: (id) => set({ selectedWireId: id, selectedComponentId: null }),

    setSelection: (componentIds, wireIds) =>
      set({
        multiSelectedComponentIds: componentIds,
        multiSelectedWireIds: wireIds,
        selectedComponentId: componentIds.length > 0 ? componentIds[0] : null,
        selectedWireId: wireIds.length > 0 ? wireIds[0] : null,
      }),

    clearMultiSelection: () => set({ multiSelectedComponentIds: [], multiSelectedWireIds: [] }),

    setHoveredTerminalId: (id) => set({ hoveredTerminalId: id }),

    clearSelection: () =>
      set({
        selectedComponentId: null,
        selectedWireId: null,
        multiSelectedComponentIds: [],
        multiSelectedWireIds: [],
      }),

    setDirty: (d) => set({ isDirty: d }),

    clearComponents: () => {
      const before = get().captureSnapshot();
      set({
        components: [],
        selectedComponentId: null,
        selectedWireId: null,
        multiSelectedComponentIds: [],
        multiSelectedWireIds: [],
        isDirty: true,
      });
      const after = get().captureSnapshot();
      pushSnapshotHistory('Clear all', before, after);
    },

    loadComponents: (components) => {
      // Rebuild refdes counters from loaded components
      const counters: Record<string, number> = {};
      for (const comp of components) {
        if (!comp.refdes) continue;
        const m = comp.refdes.match(/^([A-Za-z]+)(\d+)$/);
        if (m) {
          const key = m[1] + '_' + (comp.kicadSymbolId ?? m[1]);
          counters[key] = Math.max(counters[key] ?? 0, parseInt(m[2], 10));
        }
      }
      set({
        components,
        refdesCounters: counters,
        selectedComponentId: null,
        selectedWireId: null,
        multiSelectedComponentIds: [],
        multiSelectedWireIds: [],
      });
    },

    undo: () => {
      useHistoryStore.getState().undo();
    },

    redo: () => {
      useHistoryStore.getState().redo();
    },
  };
});

export default useSchematicStore;
