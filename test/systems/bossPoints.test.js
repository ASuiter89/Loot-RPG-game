import { describe, it, expect } from 'vitest';
import { pointsEarned } from '../../src/systems/bossPoints.js';

describe('pointsEarned', () => {
  it('counts distinct first-cleared boss floors', () => {
    expect(pointsEarned({ 5: 1, 10: 1, 15: 1 })).toBe(3);
  });
  it('counts keys, not the sum of values', () => {
    expect(pointsEarned({ 5: 1, 10: 2, 15: 9 })).toBe(3);
  });
  it('returns 0 for an empty ledger', () => {
    expect(pointsEarned({})).toBe(0);
  });
  it('tolerates missing / non-object ledgers', () => {
    expect(pointsEarned(null)).toBe(0);
    expect(pointsEarned(undefined)).toBe(0);
    expect(pointsEarned(42)).toBe(0);
    expect(pointsEarned('nope')).toBe(0);
  });
});
