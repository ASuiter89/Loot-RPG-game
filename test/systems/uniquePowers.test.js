import { describe, it, expect } from 'vitest';
import { rollUniquePowers } from '../../src/systems/uniquePowers.js';
import { UNIQUE_SECOND_POWER_CHANCE } from '../../src/data/uniques.js';
import { mulberry32 } from '../../src/utils/rng.js';

describe('rollUniquePowers', () => {
  const POOL = ['executioner', 'rending'];

  it('always grants the primary power', () => {
    expect(rollUniquePowers(POOL, () => 0.99)[0]).toBe('executioner');
    expect(rollUniquePowers(POOL, () => 0.0)[0]).toBe('executioner');
  });

  it('adds the secondary only when the roll falls under the chance', () => {
    // rng below the threshold → two powers (primary + secondary).
    expect(rollUniquePowers(POOL, () => UNIQUE_SECOND_POWER_CHANCE - 0.01)).toEqual(['executioner', 'rending']);
    // rng at/above the threshold → one power.
    expect(rollUniquePowers(POOL, () => UNIQUE_SECOND_POWER_CHANCE)).toEqual(['executioner']);
    expect(rollUniquePowers(POOL, () => 0.99)).toEqual(['executioner']);
  });

  it('never returns three (only ever the primary + at most the one secondary)', () => {
    for (let i = 0; i < 50; i++) {
      const got = rollUniquePowers(POOL, () => i / 100);
      expect(got.length).toBeLessThanOrEqual(2);
      expect(got.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('honours an explicit chance override', () => {
    expect(rollUniquePowers(POOL, () => 0.5, 1)).toHaveLength(2); // always second
    expect(rollUniquePowers(POOL, () => 0.5, 0)).toHaveLength(1); // never second
  });

  it('never mutates the pool', () => {
    const pool = ['brutal', 'cleaving'];
    rollUniquePowers(pool, () => 0);
    expect(pool).toEqual(['brutal', 'cleaving']);
  });

  it('degrades gracefully on a short or empty pool', () => {
    expect(rollUniquePowers(['solo'], () => 0)).toEqual(['solo']); // no secondary to grant
    expect(rollUniquePowers([], () => 0)).toEqual([]);
    expect(rollUniquePowers(null, () => 0)).toEqual([]);
    expect(rollUniquePowers(undefined, () => 0)).toEqual([]);
  });

  it('produces roughly the intended 67/33 split over a deterministic stream', () => {
    const rng = mulberry32(1234);
    let two = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (rollUniquePowers(POOL, rng).length === 2) two++;
    const frac = two / N;
    // Within a few points of UNIQUE_SECOND_POWER_CHANCE (0.33).
    expect(frac).toBeGreaterThan(UNIQUE_SECOND_POWER_CHANCE - 0.03);
    expect(frac).toBeLessThan(UNIQUE_SECOND_POWER_CHANCE + 0.03);
  });
});
