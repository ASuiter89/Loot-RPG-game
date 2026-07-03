import { describe, it, expect } from 'vitest';
import { milestonePower, rankScale, skillManaCost } from '../../src/systems/skillMath.js';

describe('milestonePower', () => {
  it('is 0 below rank 3', () => {
    expect(milestonePower(0)).toBe(0);
    expect(milestonePower(2)).toBe(0);
  });
  it('adds cumulative spikes at 3, 7 and 10', () => {
    expect(milestonePower(3)).toBeCloseTo(0.28, 10);
    expect(milestonePower(6)).toBeCloseTo(0.28, 10);
    expect(milestonePower(7)).toBeCloseTo(0.48, 10);
    expect(milestonePower(9)).toBeCloseTo(0.48, 10);
    expect(milestonePower(10)).toBeCloseTo(0.78, 10);
    expect(milestonePower(99)).toBeCloseTo(0.78, 10);
  });
});

describe('rankScale', () => {
  it('treats rank 0 and 1 as the baseline 1.0', () => {
    expect(rankScale(0)).toBeCloseTo(1, 10);
    expect(rankScale(1)).toBeCloseTo(1, 10);
  });
  it('grows ~12% per rank before milestones', () => {
    expect(rankScale(2)).toBeCloseTo(1.12, 10);
  });
  it('layers milestone spikes on top', () => {
    // rank 3: (1 + 0.12*2) * (1 + 0.28)
    expect(rankScale(3)).toBeCloseTo(1.24 * 1.28, 10);
    // rank 10: (1 + 0.12*9) * (1 + 0.78)
    expect(rankScale(10)).toBeCloseTo(2.08 * 1.78, 10);
  });
});

describe('skillManaCost', () => {
  it('is 0 for a missing node or a node with no mp cost', () => {
    expect(skillManaCost(null, 3)).toBe(0);
    expect(skillManaCost({}, 3)).toBe(0);
    expect(skillManaCost({ mp: 0 }, 3)).toBe(0);
  });
  it('applies the global multiplier at rank 1', () => {
    expect(skillManaCost({ mp: 10 }, 1)).toBe(15); // 10 * 1.5
  });
  it('treats rank 0 as rank 1', () => {
    expect(skillManaCost({ mp: 10 }, 0)).toBe(15);
  });
  it('climbs 8% of base per rank above the first', () => {
    expect(skillManaCost({ mp: 10 }, 2)).toBe(16); // round(15 * 1.08)
    expect(skillManaCost({ mp: 10 }, 5)).toBe(20); // round(15 * 1.32)
    expect(skillManaCost({ mp: 20 }, 10)).toBe(52); // round(30 * 1.72)
  });
  it('never returns below 1 for a real cost', () => {
    expect(skillManaCost({ mp: 1 }, 1)).toBeGreaterThanOrEqual(1);
  });
});
