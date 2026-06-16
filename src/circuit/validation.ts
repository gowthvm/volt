import type { SchematicComponent } from '@/store/schematicStore';
import type { CircuitGraph } from '@/circuit/graph';
import { componentTerminalDefinitions } from '@/circuit/graph';
import { KNOWN_SIM_TYPES } from '@/circuit/simulation';

export interface SimulationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCircuit(components: SchematicComponent[], graph: CircuitGraph): SimulationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasGround = graph.terminals.some((t) => t.role === 'ground' || t.terminalName.toUpperCase() === 'GND');
  if (!hasGround) errors.push('Circuit has no ground reference. Add a ground symbol.');

  const sources = components.filter((c) => c.params?.simType === 'battery' || c.params?.simType === 'voltage_source');
  if (sources.length === 0) errors.push('Circuit has no voltage source. Add a battery or voltage source.');

  for (const comp of components) {
    if (comp.type === 'wire') continue;
    if (comp.params?.simType === 'ground') continue;
    const st = comp.params?.simType as string | undefined;
    if (st && !KNOWN_SIM_TYPES.has(st)) {
      warnings.push(`${comp.refdes || comp.id}: unknown sim type "${st}"`);
    }
  }

  for (const comp of components) {
    if (comp.type === 'wire') continue;
    const defs = componentTerminalDefinitions(comp);
    for (const def of defs) {
      const tid = `${comp.id}:${def.name}`;
      const neighbors = graph.adjacency[tid] ?? [];
      const unconnectedRoles = new Set(['input', 'output', 'bidirectional', 'power_input', 'power_output', 'open_collector', 'open_emitter', 'passive']);
      if (neighbors.length === 0 && def.role !== 'ground' && def.name.toUpperCase() !== 'GND' && unconnectedRoles.has(def.role)) {
        warnings.push(`${comp.refdes || comp.id} pin ${def.name} (${def.role}) is unconnected.`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
