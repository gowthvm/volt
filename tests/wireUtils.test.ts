import { describe, it, expect } from 'vitest';
import { snapToGrid, dedupPoints } from '../src/lib/wireUtils';

describe('snapToGrid', () => {
  it('snaps to nearest 24px increment', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(12)).toBe(24);
    expect(snapToGrid(23)).toBe(24);
    expect(snapToGrid(24)).toBe(24);
    expect(snapToGrid(36)).toBe(48);
    expect(snapToGrid(-12)).toBe(-24);
    expect(snapToGrid(-1)).toBe(0);
  });
});

describe('dedupPoints', () => {
  it('removes consecutive points within 1px', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0.2, y: 0.3 }, { x: 10, y: 10 }];
    const result = dedupPoints(pts);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 10, y: 10 });
  });

  it('keeps points farther than 1px apart', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }];
    const result = dedupPoints(pts);
    expect(result).toHaveLength(3);
  });

  it('handles empty and single-point arrays', () => {
    expect(dedupPoints([])).toEqual([]);
    expect(dedupPoints([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
  });
});
