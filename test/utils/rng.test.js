import { describe, it, expect } from 'vitest';
import {
  sysRandom,
  mulberry32,
  rndInt,
  rndFloat,
  pick,
  chance,
  shuffle,
} from '../../src/utils/rng.js';

describe('sysRandom', () => {
  it('returns a float in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const v = sysRandom();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toEqual(b());
  });

  it('stays within [0, 1)', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has a roughly uniform mean over many draws', () => {
    const r = mulberry32(7);
    let sum = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) sum += r();
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });
});

describe('rndInt', () => {
  it('returns integers within [lo, hi] inclusive', () => {
    const r = mulberry32(3);
    const seen = new Set();
    for (let i = 0; i < 2000; i++) {
      const v = rndInt(r, 1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    // A d6 over 2000 rolls should hit every face.
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('handles a single-value range', () => {
    const r = mulberry32(5);
    expect(rndInt(r, 4, 4)).toBe(4);
  });

  it('reproduces the classic rnd(lo,hi) shape with a controllable stream', () => {
    // rng returning 0 -> lo; rng approaching 1 -> hi
    const zero = () => 0;
    const almostOne = () => 0.999999;
    expect(rndInt(zero, 10, 20)).toBe(10);
    expect(rndInt(almostOne, 10, 20)).toBe(20);
  });
});

describe('rndFloat', () => {
  it('returns floats within [lo, hi)', () => {
    const r = mulberry32(11);
    for (let i = 0; i < 1000; i++) {
      const v = rndFloat(r, -2, 2);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(2);
    }
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const r = mulberry32(42);
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 500; i++) {
      expect(arr).toContain(pick(r, arr));
    }
  });

  it('picks the only element of a singleton', () => {
    expect(pick(mulberry32(1), ['solo'])).toBe('solo');
  });
});

describe('chance', () => {
  it('is never true at p=0 and always true at p=1', () => {
    const r = mulberry32(8);
    for (let i = 0; i < 100; i++) {
      expect(chance(r, 0)).toBe(false);
      expect(chance(r, 1)).toBe(true);
    }
  });

  it('approximates the requested probability', () => {
    const r = mulberry32(2024);
    let hits = 0;
    const n = 50000;
    for (let i = 0; i < n; i++) if (chance(r, 0.3)) hits++;
    expect(hits / n).toBeGreaterThan(0.28);
    expect(hits / n).toBeLessThan(0.32);
  });
});

describe('shuffle', () => {
  it('does not mutate the input and preserves the multiset', () => {
    const r = mulberry32(17);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const frozen = input.slice();
    const out = shuffle(r, input);
    expect(input).toEqual(frozen); // unchanged
    expect(out.slice().sort((a, b) => a - b)).toEqual(frozen);
  });

  it('is deterministic for a given seed', () => {
    const out1 = shuffle(mulberry32(50), [1, 2, 3, 4, 5]);
    const out2 = shuffle(mulberry32(50), [1, 2, 3, 4, 5]);
    expect(out1).toEqual(out2);
  });

  it('actually reorders for most seeds', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle(mulberry32(123), input);
    expect(out).not.toEqual(input);
  });
});
