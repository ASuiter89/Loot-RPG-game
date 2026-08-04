import { describe, it, expect } from 'vitest';
import { GOLD_DROP_MIN, GOLD_DROP_MAX, GOLD_DROP_PER_DEPTH, GOLD_DROP_FLAT } from '../../src/data/goldDrops.js';

// Mirrors the kill payout in the game shell: rnd(MIN, MAX) + depth × PER_DEPTH,
// before the hero's own multipliers. Blessing prices read the average of this, so
// pinning the roll here pins what the Healer charges.
describe('gold drop tuning', () => {
  it('rolls a positive flat band', () => {
    expect(GOLD_DROP_MIN).toBeGreaterThan(0);
    expect(GOLD_DROP_MAX).toBeGreaterThan(GOLD_DROP_MIN);
  });

  it('adds a per-depth slice, so income climbs linearly with the floor', () => {
    expect(GOLD_DROP_PER_DEPTH).toBeGreaterThan(0);
    expect(Number.isInteger(GOLD_DROP_PER_DEPTH)).toBe(true);
  });

  it('quotes the flat roll as its mean', () => {
    expect(GOLD_DROP_FLAT).toBe((GOLD_DROP_MIN + GOLD_DROP_MAX) / 2);
    expect(GOLD_DROP_FLAT).toBe(5);
  });

  it('has depth dominate the flat roll from the first few floors on', () => {
    expect(GOLD_DROP_PER_DEPTH * 5).toBeGreaterThan(GOLD_DROP_MAX);
  });
});
