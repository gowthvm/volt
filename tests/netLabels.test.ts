import { describe, it, expect } from 'vitest';
import { computeNetLabels } from '../src/lib/netLabels';
import type { CircuitGraph } from '../src/circuit/graph';

function makeGraph(overrides?: Partial<CircuitGraph>): CircuitGraph {
  return {
    terminals: [],
    terminalMap: {},
    componentTerminalMap: {},
    edges: [],
    adjacency: {},
    junctions: [],
    ...overrides,
  };
}

describe('computeNetLabels', () => {
  it('returns empty map for empty graph', () => {
    const graph = makeGraph();
    const result = computeNetLabels(graph);
    expect(result.size).toBe(0);
  });

  it('assigns NET_1 to a single isolated terminal', () => {
    const graph = makeGraph({
      terminals: [{ id: 'r1:1', componentId: 'r1', terminalName: '1', role: 'left', position: { x: 0, y: 0 } }],
      terminalMap: { 'r1:1': { id: 'r1:1', componentId: 'r1', terminalName: '1', role: 'left', position: { x: 0, y: 0 } } },
      adjacency: { 'r1:1': [] },
    });
    const result = computeNetLabels(graph);
    expect(result.get('r1:1')).toBe('NET_1');
  });

  it('groups connected terminals under the same net', () => {
    const graph = makeGraph({
      terminals: [
        { id: 'r1:1', componentId: 'r1', terminalName: '1', role: 'left', position: { x: 0, y: 0 } },
        { id: 'r2:1', componentId: 'r2', terminalName: '1', role: 'left', position: { x: 100, y: 0 } },
      ],
      terminalMap: {
        'r1:1': { id: 'r1:1', componentId: 'r1', terminalName: '1', role: 'left', position: { x: 0, y: 0 } },
        'r2:1': { id: 'r2:1', componentId: 'r2', terminalName: '1', role: 'left', position: { x: 100, y: 0 } },
      },
      adjacency: { 'r1:1': ['r2:1'], 'r2:1': ['r1:1'] },
    });
    const result = computeNetLabels(graph);
    expect(result.get('r1:1')).toBe(result.get('r2:1'));
  });

  it('uses VCC as net name when a GND terminal is present', () => {
    const graph = makeGraph({
      terminals: [
        { id: 'bat1:VCC', componentId: 'bat1', terminalName: 'VCC', role: 'top', position: { x: 0, y: 0 } },
        { id: 'r1:1', componentId: 'r1', terminalName: '1', role: 'left', position: { x: 50, y: 0 } },
      ],
      terminalMap: {
        'bat1:VCC': { id: 'bat1:VCC', componentId: 'bat1', terminalName: 'VCC', role: 'top', position: { x: 0, y: 0 } },
        'r1:1': { id: 'r1:1', componentId: 'r1', terminalName: '1', role: 'left', position: { x: 50, y: 0 } },
      },
      adjacency: { 'bat1:VCC': ['r1:1'], 'r1:1': ['bat1:VCC'] },
    });
    const result = computeNetLabels(graph);
    expect(result.get('bat1:VCC')).toBe('VCC');
    expect(result.get('r1:1')).toBe('VCC');
  });

  it('assigns different net names to disconnected groups', () => {
    const graph = makeGraph({
      terminals: [
        { id: 'r1:1', componentId: 'r1', terminalName: '1', role: 'left', position: { x: 0, y: 0 } },
        { id: 'r2:1', componentId: 'r2', terminalName: '1', role: 'left', position: { x: 200, y: 0 } },
      ],
      terminalMap: {
        'r1:1': { id: 'r1:1', componentId: 'r1', terminalName: '1', role: 'left', position: { x: 0, y: 0 } },
        'r2:1': { id: 'r2:1', componentId: 'r2', terminalName: '1', role: 'left', position: { x: 200, y: 0 } },
      },
      adjacency: { 'r1:1': [], 'r2:1': [] },
    });
    const result = computeNetLabels(graph);
    expect(result.get('r1:1')).toBe('NET_1');
    expect(result.get('r2:1')).toBe('NET_2');
  });
});
