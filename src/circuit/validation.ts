import type { SchematicComponent } from '@/store/schematicStore';
import type { CircuitGraph } from '@/circuit/graph';
import { componentTerminalDefinitions } from '@/circuit/graph';

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

  const sources = components.filter((c) => c.params?.simType === 'battery' || c.params?.simType === 'voltage' || c.params?.simType === 'voltage_source');
  if (sources.length === 0) errors.push('Circuit has no voltage source. Add a battery or voltage source.');

  for (const comp of components) {
    if (comp.type === 'wire') continue;
    const defs = componentTerminalDefinitions(comp);
    for (const def of defs) {
      const tid = `${comp.id}:${def.name}`;
      const neighbors = graph.adjacency[tid] ?? [];
      if (neighbors.length === 0 && def.role !== 'ground' && def.name.toUpperCase() !== 'GND') {
        warnings.push(`${comp.refdes || comp.id} pin ${def.name} is unconnected.`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
