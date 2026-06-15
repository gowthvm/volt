import type { CircuitGraph } from '@/circuit/graph';

const SIGNAL_NAMES = new Set(['VCC', 'VDD', 'VSS', 'GND', 'VEE', 'VPP', 'VCCQ', 'VBAT', 'AVCC', 'AGND', 'REF', 'VREF', '3V3', '5V', '12V']);

export function computeNetLabels(graph: CircuitGraph): Map<string, string> {
  const visited = new Set<string>();
  const netMap = new Map<string, string>();
  let netCounter = 0;

  for (const terminal of graph.terminals) {
    if (visited.has(terminal.id)) continue;
    const stack = [terminal.id];
    const group: string[] = [];
    while (stack.length > 0) {
      const tid = stack.pop()!;
      if (visited.has(tid)) continue;
      visited.add(tid);
      group.push(tid);
      const neighbors = graph.adjacency[tid] ?? [];
      for (const n of neighbors) {
        if (!visited.has(n)) stack.push(n);
      }
    }
    let name = `NET_${++netCounter}`;
    for (const tid of group) {
      const termName = tid.split(':').pop() ?? '';
      if (SIGNAL_NAMES.has(termName.toUpperCase())) {
        name = termName.toUpperCase();
        break;
      }
    }
    for (const tid of group) {
      netMap.set(tid, name);
    }
  }
  return netMap;
}
