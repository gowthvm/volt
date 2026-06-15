import { describe, it, expect } from 'vitest';
import { simulate } from '../src/circuit/simulation';
import { buildCircuitGraph } from '../src/circuit/graph';
import type { SchematicComponent } from '../src/store/schematicStore';

describe('simulate', () => {
  it('solves a voltage divider: battery(9V) -> R1(1k) -> R2(2k) -> ground', () => {
    const bat: SchematicComponent = {
      id: 'bat1',
      type: 'unknown',
      confidence: 1,
      position: { x: 200, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      value: 9,
      params: { simType: 'battery', voltage: 9 },
    };
    const r1: SchematicComponent = {
      id: 'r1',
      type: 'unknown',
      confidence: 1,
      position: { x: 500, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      value: 1000,
      params: { simType: 'resistor', resistance: 1000 },
    };
    const r2: SchematicComponent = {
      id: 'r2',
      type: 'unknown',
      confidence: 1,
      position: { x: 800, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      value: 2000,
      params: { simType: 'resistor', resistance: 2000 },
    };
    const gnd: SchematicComponent = {
      id: 'gnd1',
      type: 'unknown',
      confidence: 1,
      position: { x: 500, y: 300 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      params: { simType: 'ground' },
    };
    // bat1:A (+) -> r1:A
    const wire1: SchematicComponent = {
      id: 'w1',
      type: 'wire',
      confidence: 1,
      position: { x: 350, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'bat1:A',
      terminalB: 'r1:A',
    };
    // r1:B -> r2:A
    const wire2: SchematicComponent = {
      id: 'w2',
      type: 'wire',
      confidence: 1,
      position: { x: 650, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'r1:B',
      terminalB: 'r2:A',
    };
    // r2:B -> gnd1:G
    const wire3: SchematicComponent = {
      id: 'w3',
      type: 'wire',
      confidence: 1,
      position: { x: 800, y: 200 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'r2:B',
      terminalB: 'gnd1:G',
    };
    // bat1:B (-) -> gnd1:G (return path)
    const wire4: SchematicComponent = {
      id: 'w4',
      type: 'wire',
      confidence: 1,
      position: { x: 300, y: 200 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'bat1:B',
      terminalB: 'gnd1:G',
    };

    const components = [bat, r1, r2, gnd, wire1, wire2, wire3, wire4];
    const graph = buildCircuitGraph(components, 30);
    const result = simulate(components, graph);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Voltage divider: Vout = Vin * R2 / (R1 + R2) = 9 * 2000 / 3000 = 6V at junction between R1 and R2
    // bat1:A (+) and r1:A should be at same node (~9V w.r.t. ground)
    // r1:B and r2:A should be at ~6V (midpoint)
    // r2:B, gnd1:G, bat1:B (-) should be at 0V

    const vBatA = result.nodeVoltages['bat1:A'];
    const vR1A = result.nodeVoltages['r1:A'];
    const vR1B = result.nodeVoltages['r1:B'];
    const vR2B = result.nodeVoltages['r2:B'];
    const vBatB = result.nodeVoltages['bat1:B'];

    expect(vBatA).toBeCloseTo(9, 1);
    expect(vR1A).toBeCloseTo(9, 1);
    expect(vR1B).toBeCloseTo(6, 1);
    expect(vR2B).toBeCloseTo(0, 1);
    expect(vBatB).toBeCloseTo(0, 1);

    // Voltage across R1 = 9V - 6V = 3V, current = 3V/1kΩ = 3mA
    expect(result.componentVoltages['r1']).toBeCloseTo(3, 1);
    expect(result.componentCurrents['r1']).toBeCloseTo(0.003, 5);
    // Voltage across R2 = 6V, current = 6V/2kΩ = 3mA
    expect(result.componentVoltages['r2']).toBeCloseTo(6, 1);
    expect(result.componentCurrents['r2']).toBeCloseTo(0.003, 5);
  });

  it('detects a shorted battery', () => {
    const bat: SchematicComponent = {
      id: 'bat1',
      type: 'unknown',
      confidence: 1,
      position: { x: 100, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      value: 9,
      params: { simType: 'battery', voltage: 9 },
    };
    const wire: SchematicComponent = {
      id: 'w1',
      type: 'wire',
      confidence: 1,
      position: { x: 100, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'bat1:A',
      terminalB: 'bat1:B',
      points: [{ x: 100, y: 100 }, { x: 100, y: 100 }],
    };

    const components = [bat, wire];
    const graph = buildCircuitGraph(components, 20);
    const result = simulate(components, graph);

    expect(result.success).toBe(false);
    expect(result.error).toContain('shorted');
  });

  it('returns success for empty circuit', () => {
    const result = simulate([], { terminals: [], terminalMap: {}, componentTerminalMap: {}, edges: [], adjacency: {} });
    expect(result.success).toBe(true);
  });

  it('recognizes voltage_source as a voltage source', () => {
    const vsrc: SchematicComponent = {
      id: 'vs1',
      type: 'unknown',
      confidence: 1,
      position: { x: 200, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      value: 5,
      params: { simType: 'voltage_source', voltage: 5 },
    };
    const r: SchematicComponent = {
      id: 'r1',
      type: 'unknown',
      confidence: 1,
      position: { x: 500, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      value: 100,
      params: { simType: 'resistor', resistance: 100 },
    };
    const gnd: SchematicComponent = {
      id: 'gnd1',
      type: 'unknown',
      confidence: 1,
      position: { x: 300, y: 250 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      params: { simType: 'ground' },
    };
    // vs1:A (+) -> r1:A (top rail)
    const w1: SchematicComponent = {
      id: 'w1',
      type: 'wire',
      confidence: 1,
      position: { x: 350, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'vs1:A',
      terminalB: 'r1:A',
    };
    // r1:B -> gnd1:G
    const w2: SchematicComponent = {
      id: 'w2',
      type: 'wire',
      confidence: 1,
      position: { x: 500, y: 175 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'r1:B',
      terminalB: 'gnd1:G',
    };
    // vs1:B (-) -> gnd1:G (return path)
    const w3: SchematicComponent = {
      id: 'w3',
      type: 'wire',
      confidence: 1,
      position: { x: 250, y: 175 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'vs1:B',
      terminalB: 'gnd1:G',
    };

    const components = [vsrc, r, gnd, w1, w2, w3];
    const graph = buildCircuitGraph(components, 30);
    const result = simulate(components, graph);

    expect(result.success).toBe(true);
    // 5V source, 100 ohm resistor -> I = 50mA
    expect(result.componentCurrents['r1']).toBeCloseTo(0.05, 4);
    expect(result.componentVoltages['r1']).toBeCloseTo(5, 1);
  });

  it('handles current_source', () => {
    const isrc: SchematicComponent = {
      id: 'is1',
      type: 'unknown',
      confidence: 1,
      position: { x: 200, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      params: { simType: 'current_source', current: 0.001 },
    };
    const r: SchematicComponent = {
      id: 'r1',
      type: 'unknown',
      confidence: 1,
      position: { x: 500, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      value: 2000,
      params: { simType: 'resistor', resistance: 2000 },
    };
    const gnd: SchematicComponent = {
      id: 'gnd1',
      type: 'unknown',
      confidence: 1,
      position: { x: 300, y: 250 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      params: { simType: 'ground' },
    };
    // is1:A (+) -> r1:A (current injection)
    const w1: SchematicComponent = {
      id: 'w1',
      type: 'wire',
      confidence: 1,
      position: { x: 350, y: 100 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'is1:A',
      terminalB: 'r1:A',
    };
    // r1:B -> gnd1:G
    const w2: SchematicComponent = {
      id: 'w2',
      type: 'wire',
      confidence: 1,
      position: { x: 500, y: 175 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'r1:B',
      terminalB: 'gnd1:G',
    };
    // is1:B (-) -> gnd1:G (return path)
    const w3: SchematicComponent = {
      id: 'w3',
      type: 'wire',
      confidence: 1,
      position: { x: 250, y: 175 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      terminalA: 'is1:B',
      terminalB: 'gnd1:G',
    };

    const components = [isrc, r, gnd, w1, w2, w3];
    const graph = buildCircuitGraph(components, 30);
    const result = simulate(components, graph);

    expect(result.success).toBe(true);
    // 1mA current source, 2k resistor -> |V| = 2V, |I| = 1mA
    expect(Math.abs(result.componentVoltages['r1'] ?? 0)).toBeCloseTo(2, 1);
    expect(Math.abs(result.componentCurrents['r1'] ?? 0)).toBeCloseTo(0.001, 6);
  });
});
