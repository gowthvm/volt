import type { SchematicComponent } from '@/store/schematicStore';
import type { CircuitGraph } from '@/circuit/graph';
import { componentTerminalDefinitions } from '@/circuit/graph';

export interface SimulationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  nodeVoltages: Record<string, number>;
  terminalNodes: Record<string, number>;
  componentVoltages: Record<string, number>;
  componentCurrents: Record<string, number>;
  componentPowers: Record<string, number>;
}

const DEFAULT_RESISTANCE = 1000;
const DEFAULT_BATTERY_VOLTAGE = 9;
const DEFAULT_VOLTAGE_SOURCE_VOLTAGE = 5;
const DEFAULT_CURRENT_SOURCE_CURRENT = 0.001;
const DEFAULT_LED_FORWARD_VOLTAGE = 2.0;
const LED_SERIES_RESISTANCE = 10;
const DEFAULT_DIODE_FORWARD_VOLTAGE = 0.7;
const DIODE_SERIES_RESISTANCE = 1;
const SWITCH_CLOSED_RESISTANCE = 0.001;

type SimType = 'resistor' | 'battery' | 'led' | 'diode' | 'current_source';

interface MNAComponent {
  id: string;
  type: SimType;
  nodeA: number;
  nodeB: number;
  value: number;
  forwardVoltage?: number;
}

/** Resolve the simulation type from params.simType, falling back to legacy component.type */
function simType(comp: SchematicComponent): string {
  return (comp.params?.simType as string) ?? comp.type;
}

/** Set of known simTypes for validation */
export const KNOWN_SIM_TYPES = new Set([
  'resistor', 'battery', 'voltage_source', 'current_source',
  'led', 'diode', 'switch', 'ground', 'capacitor', 'inductor',
]);

function findConnectedTerminals(
  start: string,
  adjacency: Record<string, string[]>,
  visited: Set<string>
): string[] {
  const group: string[] = [];
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    group.push(cur);
    for (const n of adjacency[cur] ?? []) {
      if (!visited.has(n)) queue.push(n);
    }
  }
  return group;
}

function buildNodeMap(
  graph: CircuitGraph,
  components: SchematicComponent[]
): { terminalToNode: Map<string, number>; numNodes: number } {
  const terminalToNode = new Map<string, number>();
  const visited = new Set<string>();
  let nextNode = 0;

  // Ground detection: find component with simType === 'ground' or legacy type === 'ground'
  const groundComp = components.find((c) => simType(c) === 'ground');
  if (groundComp) {
    const defs = componentTerminalDefinitions(groundComp);
    const gDef = defs.find((d) => d.role === 'ground');
    const groundTid = gDef ? `${groundComp.id}:${gDef.name}` : `${groundComp.id}:G`;
    const group = findConnectedTerminals(groundTid, graph.adjacency, visited);
    for (const tid of group) terminalToNode.set(tid, 0);
    nextNode = 1;
  }

  for (const terminal of graph.terminals) {
    if (visited.has(terminal.id)) continue;
    const group = findConnectedTerminals(terminal.id, graph.adjacency, visited);
    const idx = nextNode++;
    for (const tid of group) terminalToNode.set(tid, idx);
  }

  return { terminalToNode, numNodes: groundComp ? nextNode - 1 : nextNode };
}

function getTwoTerminalIds(comp: SchematicComponent): { a: string; b: string } | null {
  const defs = componentTerminalDefinitions(comp);
  if (defs.length < 2) return null;
  return { a: `${comp.id}:${defs[0].name}`, b: `${comp.id}:${defs[1].name}` };
}

function componentValue(comp: SchematicComponent): number {
  const st = simType(comp);
  const p = comp.params;
  if (p) {
    switch (st) {
      case 'resistor':
        return typeof p.resistance === 'number' ? p.resistance : (comp.value ?? DEFAULT_RESISTANCE);
      case 'battery':
        return typeof p.voltage === 'number' ? p.voltage : (comp.value ?? DEFAULT_BATTERY_VOLTAGE);
      case 'voltage_source':
        return typeof p.voltage === 'number' ? p.voltage : (comp.value ?? DEFAULT_VOLTAGE_SOURCE_VOLTAGE);
      case 'current_source':
        return typeof p.current === 'number' ? p.current : (comp.value ?? DEFAULT_CURRENT_SOURCE_CURRENT);
      case 'led':
        return comp.value ?? LED_SERIES_RESISTANCE;
      case 'diode':
        return comp.value ?? DIODE_SERIES_RESISTANCE;
      case 'switch':
        return p.closed === false ? 1e6 : (comp.value ?? SWITCH_CLOSED_RESISTANCE);
      case 'capacitor':
        return Infinity;
      case 'inductor':
        return 1e-9;
    }
  }
  if (comp.value !== undefined) return comp.value;
  switch (st) {
    case 'resistor':
      return DEFAULT_RESISTANCE;
    case 'battery':
    case 'voltage_source':
      return st === 'battery' ? DEFAULT_BATTERY_VOLTAGE : DEFAULT_VOLTAGE_SOURCE_VOLTAGE;
    case 'led':
      return LED_SERIES_RESISTANCE;
    case 'diode':
      return DIODE_SERIES_RESISTANCE;
    case 'switch':
      return SWITCH_CLOSED_RESISTANCE;
    case 'current_source':
      return DEFAULT_CURRENT_SOURCE_CURRENT;
    case 'capacitor':
      return Infinity;
    case 'inductor':
      return 1e-9;
    default:
      return Infinity;
  }
}

function gaussSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    if (Math.abs(M[maxRow][col]) < 1e-14) {
      throw new Error(
        'Singular matrix — circuit may be floating (no path to ground) or a voltage source is shorted'
      );
    }
    if (maxRow !== col) {
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
    }
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

function solveWithComponents(
  mnaComponents: MNAComponent[],
  numNodes: number
): { voltages: number[]; vsrcCurrents: number[]; vsrcIndexForId: Map<string, number> } {
  const vsrcComponents = mnaComponents.filter((c) => c.type !== 'resistor' && c.type !== 'current_source');
  const numVsrc = vsrcComponents.length;
  const size = numNodes + numVsrc;
  const vsrcIndexForId = new Map<string, number>();

  const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const b: number[] = new Array(size).fill(0);

  let vi = 0;
  for (const comp of mnaComponents) {
    const na = comp.nodeA - 1;
    const nb = comp.nodeB - 1;

    if (comp.type === 'resistor') {
      const g = 1 / comp.value;
      if (na >= 0) {
        A[na][na] += g;
        if (nb >= 0) A[na][nb] -= g;
      }
      if (nb >= 0) {
        A[nb][nb] += g;
        if (na >= 0) A[nb][na] -= g;
      }
    } else if (comp.type === 'current_source') {
      if (na >= 0) b[na] -= comp.value;
      if (nb >= 0) b[nb] += comp.value;
    } else {
      const col = numNodes + vi;
      vsrcIndexForId.set(comp.id, vi);

      if (na >= 0) {
        A[na][col] += 1;
        A[col][na] += 1;
      }
      if (nb >= 0) {
        A[nb][col] -= 1;
        A[col][nb] -= 1;
      }

      if (comp.type === 'led') {
        A[col][col] = -comp.value;
        b[col] = comp.forwardVoltage ?? DEFAULT_LED_FORWARD_VOLTAGE;
      } else if (comp.type === 'diode') {
        A[col][col] = -comp.value;
        b[col] = comp.forwardVoltage ?? DEFAULT_DIODE_FORWARD_VOLTAGE;
      } else {
        b[col] = comp.value;
      }
      vi++;
    }
  }

  if (size === 0) {
    return { voltages: new Array(numNodes + 1).fill(0), vsrcCurrents: [], vsrcIndexForId };
  }

  const solution = gaussSolve(A, b);

  const voltages = new Array(numNodes + 1).fill(0);
  for (let i = 0; i < numNodes; i++) voltages[i + 1] = solution[i];

  const vsrcCurrents = new Array(numVsrc).fill(0);
  for (let i = 0; i < numVsrc; i++) vsrcCurrents[i] = solution[numNodes + i];

  return { voltages, vsrcCurrents, vsrcIndexForId };
}

export function simulate(
  components: SchematicComponent[],
  graph: CircuitGraph
): SimulationResult {
  const result: SimulationResult = {
    success: false,
    error: undefined,
    warnings: [],
    nodeVoltages: {},
    terminalNodes: {},
    componentVoltages: {},
    componentCurrents: {},
    componentPowers: {},
  };

  try {
    const nonWire = components.filter((c) => c.type !== 'wire');

    if (nonWire.length === 0) {
      result.success = true;
      return result;
    }

    // Collect DC approximation warnings
    const dcApprox: string[] = [];
    for (const comp of nonWire) {
      const st = simType(comp);
      if (st === 'capacitor') dcApprox.push(`${comp.refdes || comp.id}: capacitor acts as open circuit in DC`);
      if (st === 'inductor') dcApprox.push(`${comp.refdes || comp.id}: inductor acts as short circuit in DC`);
    }
    if (dcApprox.length > 0) result.warnings = dcApprox;

    const { terminalToNode, numNodes } = buildNodeMap(graph, components);
    result.terminalNodes = Object.fromEntries(terminalToNode);

    const mnaComponents: MNAComponent[] = [];

    for (const comp of nonWire) {
      const st = simType(comp);
      const ids = getTwoTerminalIds(comp);
      if (!ids) continue;

      const tidA = terminalToNode.get(ids.a);
      const tidB = terminalToNode.get(ids.b);

      if (tidA === undefined || tidB === undefined) continue;

      if (tidA === tidB) {
        if (st === 'battery' || st === 'led' || st === 'diode' || st === 'voltage_source') {
          result.error = `${st} '${comp.id.slice(0, 6)}' is shorted — both terminals are at the same electrical node`;
          return result;
        }
        continue;
      }

      const mnaType: SimType = st === 'led' ? 'led'
        : (st === 'battery' || st === 'voltage_source') ? 'battery'
        : st === 'diode' ? 'diode'
        : st === 'current_source' ? 'current_source'
        : 'resistor';
      const fv = st === 'led'
        ? (comp.params?.forwardVoltage as number | undefined) ?? DEFAULT_LED_FORWARD_VOLTAGE
        : st === 'diode'
          ? (comp.params?.forwardVoltage as number | undefined) ?? DEFAULT_DIODE_FORWARD_VOLTAGE
          : undefined;
      mnaComponents.push({
        id: comp.id,
        type: mnaType,
        nodeA: tidA,
        nodeB: tidB,
        value: componentValue(comp),
        forwardVoltage: fv,
      });
    }

    if (mnaComponents.length === 0) {
      result.success = true;
      return result;
    }

    const hasVoltageSource = mnaComponents.some((c) => c.type !== 'resistor' && c.type !== 'current_source');
    const hasResistor = mnaComponents.some((c) => c.type === 'resistor');

    if (hasVoltageSource && !hasResistor) {
      result.error = 'Circuit has voltage sources but no resistive path — infinite current';
      return result;
    }

    if (mnaComponents.every((c) => c.type === 'resistor')) {
      result.success = true;
      return result;
    }

    let nonlinearIndices: number[] = [];
    mnaComponents.forEach((c, i) => {
      if (c.type === 'led' || c.type === 'diode') nonlinearIndices.push(i);
    });

    let activeMna = mnaComponents.map((c) => ({ ...c }));
    let iteration = 0;
    const maxIter = 5;

    while (iteration < maxIter) {
      const solved = solveWithComponents(activeMna, numNodes);
      const { voltages, vsrcCurrents, vsrcIndexForId } = solved;

      let converged = true;

      if (nonlinearIndices.length > 0) {
        let changed = false;
        for (const idx of nonlinearIndices) {
          const comp = activeMna[idx];
          const vsrcIdx = vsrcIndexForId.get(comp.id);
          if (vsrcIdx === undefined) continue;

          const mnaCurrent = vsrcCurrents[vsrcIdx];

          if (mnaCurrent < -1e-12) {
            const compIdx = activeMna.findIndex((c) => c.id === comp.id);
            if (compIdx >= 0) {
              activeMna.splice(compIdx, 1);
              changed = true;
            }
          }
        }
        if (changed) {
          nonlinearIndices = [];
          activeMna.forEach((c, i) => {
            if (c.type === 'led' || c.type === 'diode') nonlinearIndices.push(i);
          });
          converged = false;
        }
      }

      if (converged) {
        const nodeV: Record<string, number> = {};
        for (const [tid, nodeIdx] of terminalToNode) {
          nodeV[tid] = voltages[nodeIdx];
        }

        const compV: Record<string, number> = {};
        const compI: Record<string, number> = {};
        const compP: Record<string, number> = {};

        for (const comp of nonWire) {
          const ids = getTwoTerminalIds(comp);
          if (!ids) continue;
          const va = nodeV[ids.a] ?? 0;
          const vb = nodeV[ids.b] ?? 0;
          const vdiff = va - vb;
          compV[comp.id] = vdiff;

          const active = activeMna.find((c) => c.id === comp.id);
          if (active) {
            if (active.type === 'resistor') {
              const i = vdiff / active.value;
              compI[comp.id] = i;
              compP[comp.id] = vdiff * i;
            } else if (active.type === 'current_source') {
              const i = active.value;
              compI[comp.id] = i;
              compP[comp.id] = vdiff * i;
            } else {
              const vsrcIdx = vsrcIndexForId.get(comp.id);
              if (vsrcIdx !== undefined) {
                const i = vsrcCurrents[vsrcIdx];
                compI[comp.id] = i;
                compP[comp.id] = vdiff * i;
              }
            }
          }
        }

        result.nodeVoltages = nodeV;
        result.componentVoltages = compV;
        result.componentCurrents = compI;
        result.componentPowers = compP;
        result.success = true;
        return result;
      }

      iteration++;
    }

    result.error = 'LED/diode bias iteration did not converge';
    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Unknown simulation error';
    return result;
  }
}
