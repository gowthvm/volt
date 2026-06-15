import { describe, it, expect } from 'vitest';
import { getGridStyle } from '../src/lib/renderUtils';

describe('getGridStyle', () => {
  it('returns lower alpha at low zoom', () => {
    const style = getGridStyle(0.2);
    expect(style.lineColor).toMatch(/rgba\(/);
    expect(style.dotColor).toMatch(/rgba\(/);
  });

  it('returns higher alpha at high zoom', () => {
    const style = getGridStyle(2);
    expect(style.lineColor).toMatch(/rgba\(/);
    expect(style.dotColor).toMatch(/rgba\(/);
  });

  it('clamps alpha values within expected range', () => {
    const lowZoom = getGridStyle(0.1);
    const highZoom = getGridStyle(5);
    expect(lowZoom.dotColor).toMatch(/0\.0[0-9]\)$/);
    expect(highZoom.lineColor).toMatch(/rgba\(255,255,255,0\.2\)$/);
  });
});
