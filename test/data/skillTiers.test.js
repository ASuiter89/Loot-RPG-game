import { describe, it, expect } from 'vitest';
import { SKILL_TIER_LEVELS, ASC_TIER_LEVELS } from '../../src/data/skillTiers.js';

describe('SKILL_TIER_LEVELS data validity', () => {
  it('opens at hero level 1 so a fresh hero can spend their first point', () => {
    expect(SKILL_TIER_LEVELS[0]).toBe(1);
  });

  it('gates the second tier at level 6 — the opening tier carries the early levels', () => {
    expect(SKILL_TIER_LEVELS[1]).toBe(6);
  });

  it('is six strictly ascending whole levels', () => {
    expect(SKILL_TIER_LEVELS).toHaveLength(6);
    for (const [i, lv] of SKILL_TIER_LEVELS.entries()) {
      expect(Number.isInteger(lv), `tier ${i} is a whole level`).toBe(true);
      if (i) expect(lv, `tier ${i} is deeper than tier ${i - 1}`).toBeGreaterThan(SKILL_TIER_LEVELS[i - 1]);
    }
  });

  it('never gates a tier past a level the hero can bank enough points for', () => {
    // One skill point per level (none at creation), so a hero at the tier's level has
    // level-1 points — always at least the tier index, or the tier is unreachable.
    for (const [i, lv] of SKILL_TIER_LEVELS.entries()) expect(lv - 1).toBeGreaterThanOrEqual(i);
  });
});

describe('ASC_TIER_LEVELS data validity', () => {
  it('is three ascending tiers starting at the ascension level', () => {
    expect(ASC_TIER_LEVELS).toEqual([20, 25, 31]);
  });
});
