import { describe, it, expect } from 'vitest';
import { COVENANTS } from '../../src/data/covenants.js';
import { malaiseMult, malaiseActive, combinedMalaiseRate } from '../../src/systems/malaise.js';

describe('malaiseMult', () => {
  it('is ×1 before the first step elapses', () => {
    expect(malaiseMult(0, 0.02)).toBe(1);
    expect(malaiseMult(29, 0.02)).toBe(1);   // step 30, still 0 completed steps
  });

  it('ramps stepwise: +rate per completed step', () => {
    expect(malaiseMult(30, 0.02)).toBeCloseTo(1.02, 10);  // 1 step
    expect(malaiseMult(59, 0.02)).toBeCloseTo(1.02, 10);  // still 1 step
    expect(malaiseMult(60, 0.02)).toBeCloseTo(1.04, 10);  // 2 steps
    expect(malaiseMult(150, 0.02)).toBeCloseTo(1.10, 10); // 5 steps
  });

  it('plateaus at the cap and never exceeds it', () => {
    expect(malaiseMult(1e6, 0.02)).toBeCloseTo(1.6, 10);  // default cap 0.6
    for (let t = 0; t <= 5000; t += 137) expect(malaiseMult(t, 0.05)).toBeLessThanOrEqual(1.6);
  });

  it('is monotonic non-decreasing in elapsed time', () => {
    let prev = 0;
    for (let t = 0; t <= 4000; t += 7) {
      const v = malaiseMult(t, 0.03);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('is a no-op for a zero/negative rate', () => {
    expect(malaiseMult(9999, 0)).toBe(1);
    expect(malaiseMult(9999, -1)).toBe(1);
  });

  it('honours a custom cfg and guards a zero step (no divide-by-zero)', () => {
    expect(malaiseMult(100, 0.1, { step: 50, cap: 1 })).toBeCloseTo(1.2, 10); // 2 steps
    expect(malaiseMult(100, 0.1, { step: 20, cap: 0.15 })).toBeCloseTo(1.15, 10); // capped
    expect(Number.isFinite(malaiseMult(100, 0.1, { step: 0, cap: 1 }))).toBe(true);
  });

  it('clamps garbage inputs to a safe ×1-or-more', () => {
    expect(malaiseMult(NaN, 0.02)).toBe(1);
    expect(malaiseMult(-50, 0.02)).toBe(1);
    expect(malaiseMult(100, NaN)).toBe(1);
  });
});

describe('malaiseActive', () => {
  const data = [
    { id: 'calm', dread: 1, params: { enemyHpMult: 1.2 } },
    { id: 'tempo', dread: 3, params: { malaiseRate: 0.03 } },
  ];
  it('is true only when an active covenant has a positive malaiseRate', () => {
    expect(malaiseActive(['calm'], data)).toBe(false);
    expect(malaiseActive(['calm', 'tempo'], data)).toBe(true);
    expect(malaiseActive([], data)).toBe(false);
    expect(malaiseActive(null, data)).toBe(false);
  });
  it('works against the real catalog (a tempo covenant exists)', () => {
    const tempoId = COVENANTS.find((c) => (c.params.malaiseRate || 0) > 0).id;
    expect(malaiseActive([tempoId])).toBe(true);
    expect(malaiseActive(['cov_frenzy'])).toBe(false);
  });
});

describe('combinedMalaiseRate', () => {
  const data = [
    { id: 't1', dread: 3, params: { malaiseRate: 0.02 } },
    { id: 't2', dread: 4, params: { malaiseRate: 0.035 } },
    { id: 'x', dread: 1, params: { enemyHpMult: 1.5 } },
  ];
  it('sums the malaiseRate of active tempo covenants', () => {
    expect(combinedMalaiseRate(['t1', 't2', 'x'], data)).toBeCloseTo(0.055, 10);
  });
  it('dedups and is 0 when none are active', () => {
    expect(combinedMalaiseRate(['t1', 't1'], data)).toBeCloseTo(0.02, 10);
    expect(combinedMalaiseRate(['x'], data)).toBe(0);
    expect(combinedMalaiseRate([], data)).toBe(0);
    expect(combinedMalaiseRate(null, data)).toBe(0);
  });
});
