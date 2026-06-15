import { describe, it, expect } from 'vitest';
import { pointToSegmentDist } from '../src/lib/hitTest';

describe('pointToSegmentDist', () => {
  it('returns 0 when point is on the segment', () => {
    expect(pointToSegmentDist(5, 5, 0, 0, 10, 10)).toBeCloseTo(0, 5);
  });

  it('returns perpendicular distance from the segment', () => {
    const d = pointToSegmentDist(0, 5, -10, 0, 10, 0);
    expect(d).toBeCloseTo(5, 5);
  });

  it('returns distance to endpoint when projection is beyond the segment', () => {
    const d = pointToSegmentDist(15, 15, 0, 0, 10, 0);
    expect(d).toBeCloseTo(Math.hypot(5, 15), 5);
  });

  it('handles zero-length segments', () => {
    const d = pointToSegmentDist(3, 4, 1, 1, 1, 1);
    expect(d).toBeCloseTo(Math.hypot(2, 3), 5);
  });
});
