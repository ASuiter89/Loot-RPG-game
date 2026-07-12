import { describe, it, expect } from 'vitest';
import {
  randomDistinctTiles, wanderNeighbors, pickWanderTarget, joinNames,
} from '../../src/systems/townWander.js';
import { mulberry32 } from '../../src/utils/rng.js';

describe('randomDistinctTiles', () => {
  const tiles = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 0 }));

  it('returns exactly n distinct tiles from the pool', () => {
    const out = randomDistinctTiles(tiles, 5, mulberry32(1));
    expect(out).toHaveLength(5);
    const keys = new Set(out.map((t) => t.x + ',' + t.y));
    expect(keys.size).toBe(5);
    for (const t of out) expect(tiles.some((s) => s.x === t.x && s.y === t.y)).toBe(true);
  });

  it('is deterministic for a seeded stream', () => {
    const a = randomDistinctTiles(tiles, 6, mulberry32(42));
    const b = randomDistinctTiles(tiles, 6, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('never returns more than the pool holds', () => {
    const out = randomDistinctTiles(tiles.slice(0, 3), 10, mulberry32(7));
    expect(out).toHaveLength(3);
  });

  it('does not mutate the input pool', () => {
    const pool = tiles.slice(0, 4);
    const before = pool.map((t) => t.x);
    randomDistinctTiles(pool, 4, mulberry32(3));
    expect(pool.map((t) => t.x)).toEqual(before);
  });

  it('returns an empty array for n <= 0', () => {
    expect(randomDistinctTiles(tiles, 0, mulberry32(1))).toEqual([]);
  });
});

describe('wanderNeighbors', () => {
  const allFree = () => true;

  it('returns the 4 orthogonal neighbours when all are free and in range', () => {
    const out = wanderNeighbors({ x: 5, y: 5 }, { x: 5, y: 5 }, 3, allFree);
    expect(out).toHaveLength(4);
    expect(out).toEqual(expect.arrayContaining([
      { x: 6, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 4 },
    ]));
  });

  it('excludes blocked tiles', () => {
    const isFree = (x, y) => !(x === 6 && y === 5);
    const out = wanderNeighbors({ x: 5, y: 5 }, { x: 5, y: 5 }, 3, isFree);
    expect(out.some((t) => t.x === 6 && t.y === 5)).toBe(false);
    expect(out).toHaveLength(3);
  });

  it('never steps beyond the Chebyshev radius of home', () => {
    // At the eastern edge of the patch: stepping further east would exceed radius.
    const out = wanderNeighbors({ x: 8, y: 5 }, { x: 5, y: 5 }, 3, allFree);
    expect(out.some((t) => t.x === 9)).toBe(false);
    expect(out.some((t) => t.x === 7)).toBe(true); // back toward home is fine
  });

  it('never emits a diagonal (orthogonal steps only)', () => {
    const out = wanderNeighbors({ x: 5, y: 5 }, { x: 5, y: 5 }, 3, allFree);
    for (const t of out) expect(Math.abs(t.x - 5) + Math.abs(t.y - 5)).toBe(1);
  });
});

describe('pickWanderTarget', () => {
  it('returns null when the keeper is boxed in', () => {
    expect(pickWanderTarget({ x: 5, y: 5 }, { x: 5, y: 5 }, 3, () => false, mulberry32(1))).toBeNull();
  });

  it('returns a legal in-range walkable neighbour', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 25; i++) {
      const t = pickWanderTarget({ x: 5, y: 5 }, { x: 5, y: 5 }, 3, () => true, rng);
      expect(Math.abs(t.x - 5) + Math.abs(t.y - 5)).toBe(1);
    }
  });

  it('is deterministic for a seeded stream', () => {
    expect(pickWanderTarget({ x: 2, y: 2 }, { x: 2, y: 2 }, 2, () => true, mulberry32(5)))
      .toEqual(pickWanderTarget({ x: 2, y: 2 }, { x: 2, y: 2 }, 2, () => true, mulberry32(5)));
  });
});

describe('joinNames', () => {
  it('joins one, two and three-plus names', () => {
    expect(joinNames(['Vault'])).toBe('Vault');
    expect(joinNames(['Vault', 'Merchant'])).toBe('Vault & Merchant');
    expect(joinNames(['Vault', 'Merchant', 'Healer'])).toBe('Vault, Merchant & Healer');
    expect(joinNames(['A', 'B', 'C', 'D'])).toBe('A, B, C & D');
  });

  it('drops falsy entries and handles the empty list', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames([null, 'Solo', undefined])).toBe('Solo');
  });
});
