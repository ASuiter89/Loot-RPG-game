import { describe, it, expect } from 'vitest';
import { tierUnlockLevel, tierUnlocked } from '../../src/systems/skillTiers.js';
import { SKILL_TIER_LEVELS, ASC_TIER_LEVELS } from '../../src/data/skillTiers.js';

describe('tierUnlockLevel', () => {
  it('reads the base-tree ladder by tier', () => {
    for (const [i, lv] of SKILL_TIER_LEVELS.entries()) expect(tierUnlockLevel(i)).toBe(lv);
  });

  it('opens the second tier at level 6', () => {
    expect(tierUnlockLevel(1)).toBe(6);
  });

  it('takes an explicit ladder (the ascendancy path tiers)', () => {
    expect(tierUnlockLevel(0, ASC_TIER_LEVELS)).toBe(20);
    expect(tierUnlockLevel(2, ASC_TIER_LEVELS)).toBe(31);
  });

  it('clamps a tier past the end of the ladder to its deepest gate', () => {
    expect(tierUnlockLevel(99)).toBe(SKILL_TIER_LEVELS[SKILL_TIER_LEVELS.length - 1]);
  });

  it('treats a missing, negative or fractional tier as the first one', () => {
    expect(tierUnlockLevel(undefined)).toBe(1);
    expect(tierUnlockLevel(-3)).toBe(1);
    expect(tierUnlockLevel(0.9)).toBe(1);
  });

  it('falls back to level 1 on an empty or missing ladder', () => {
    expect(tierUnlockLevel(2, [])).toBe(1);
    expect(tierUnlockLevel(2, null)).toBe(1);
  });

  it('never returns a level below 1', () => {
    expect(tierUnlockLevel(0, [0])).toBe(1);
  });
});

describe('tierUnlocked', () => {
  it('holds the second tier shut until level 6', () => {
    for (const lv of [1, 2, 3, 4, 5]) expect(tierUnlocked(lv, 1)).toBe(false);
    expect(tierUnlocked(6, 1)).toBe(true);
    expect(tierUnlocked(7, 1)).toBe(true);
  });

  it('leaves the root tier open to a level-1 hero', () => {
    expect(tierUnlocked(1, 0)).toBe(true);
  });

  it('treats a missing level as level 1', () => {
    expect(tierUnlocked(undefined, 0)).toBe(true);
    expect(tierUnlocked(undefined, 1)).toBe(false);
  });

  it('honours an explicit ladder', () => {
    expect(tierUnlocked(19, 0, ASC_TIER_LEVELS)).toBe(false);
    expect(tierUnlocked(20, 0, ASC_TIER_LEVELS)).toBe(true);
  });
});
