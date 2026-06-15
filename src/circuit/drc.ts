import type { SchematicComponent } from '@/store/schematicStore';
import type { CircuitGraph } from '@/circuit/graph';
import { componentTerminalDefinitions } from '@/circuit/graph';

export interface DRCReport {
  errors: DRCItem[];
  warnings: DRCItem[];
}

export interface DRCItem {
  type: 'error' | 'warning';
  message: string;
  componentId?: string;
  terminalId?: string;
}

export function runDRC(components: SchematicComponent[], graph: CircuitGraph): DRCReport {
  const errors: DRCItem[] = [];
  const warnings: DRCItem[] = [];

  const isWire = (c: SchematicComponent) => c.type === 'wire';

  // 1. Unconnected pins
  for (const comp of components) {
    if (isWire(comp)) continue;
    const defs = componentTerminalDefinitions(comp);
    for (const def of defs) {
      const tid = `${comp.id}:${def.name}`;
      if (def.role === 'ground' || def.name.toUpperCase() === 'GND') continue;
      const neighbors = graph.adjacency[tid] ?? [];
      if (neighbors.length === 0) {
        warnings.push({
          type: 'warning',
          message: `${comp.refdes || comp.id}: pin ${def.name} (${def.role}) is unconnected`,
          componentId: comp.id,
          terminalId: tid,
        });
      }
    }
  }

  // 2. Dangling wires
  for (const comp of components) {
    if (!isWire(comp)) continue;
    const tA = comp.terminalA ? graph.terminalMap[comp.terminalA] : undefined;
    const tB = comp.terminalB ? graph.terminalMap[comp.terminalB] : undefined;
    if (!tA || !tB) {
      errors.push({
        type: 'error',
        message: `Wire ${comp.refdes || comp.id} has a dangling endpoint`,
        componentId: comp.id,
      });
    }
  }

  // 3. No ground reference
  const hasGround = graph.terminals.some((t) => t.role === 'ground' || t.terminalName.toUpperCase() === 'GND');
  if (!hasGround) {
    errors.push({
      type: 'error',
      message: 'No ground reference found — add a ground symbol for simulation',
    });
  }

  // 4. No voltage source
  const hasSource = components.some((c) => c.params?.simType === 'battery' || c.params?.simType === 'voltage' || c.params?.simType === 'voltage_source');
  if (!hasSource) {
    warnings.push({
      type: 'warning',
      message: 'No voltage source found — add a battery or voltage source to power the circuit',
    });
  }

  // 5. Short circuit detection (terminals connected without any component between them)
  for (const edge of graph.edges) {
    if (edge.type !== 'implicit') continue;
    const srcTerm = graph.terminalMap[edge.sourceTerminalId];
    const tgtTerm = graph.terminalMap[edge.targetTerminalId];
    if (srcTerm && tgtTerm && srcTerm.componentId !== tgtTerm.componentId) {
      const srcComp = components.find((c) => c.id === srcTerm.componentId);
      const tgtComp = components.find((c) => c.id === tgtTerm.componentId);
      if (srcComp && !isWire(srcComp) && tgtComp && !isWire(tgtComp)) {
        errors.push({
          type: 'error',
          message: `Possible short: ${srcComp.refdes || srcComp.id}:${srcTerm.terminalName} directly connected to ${tgtComp.refdes || tgtComp.id}:${tgtTerm.terminalName} without a wire`,
        });
      }
    }
  }

  return { errors, warnings };
}
