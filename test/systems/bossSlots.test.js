import { describe, it, expect } from 'vitest';
import { BOSS_SLOTS } from '../../src/data/bossSlots.js';
import {
  slotMultiplier,
  pointsEarned,
  pointsSpent,
  pointsAvailable,
  totalLevelsInvested,
  respecCost,
  sanitizeSlotLevels,
} from '../../src/systems/bossSlots.js';

const SLOT_KEYS = ['weapon', 'offhand', 'head', 'chest', 'hands', 'legs', 'ring', 'amulet'];

describe('slotMultiplier', () => {
  it('is a no-op at level 0 (byte-identical to no feature)', () => {
    expect(slotMultiplier(0)).toBe(1);
    expect(slotMultiplier(undefined)).toBe(1);
    expect(slotMultiplier(null)).toBe(1);
  });

  it('adds perLevel per level, linearly and uncapped', () => {
    expect(slotMultiplier(1)).toBeCloseTo(1.05, 10);
    expect(slotMultiplier(3)).toBeCloseTo(1.15, 10);
    expect(slotMultiplier(10)).toBeCloseTo(1.5, 10);
    expect(slotMultiplier(40)).toBeCloseTo(1 + BOSS_SLOTS.perLevel * 40, 10); // no ceiling
  });

  it('floors fractional levels and clamps negatives to 1', () => {
    expect(slotMultiplier(2.9)).toBeCloseTo(1.10, 10); // floor(2.9) = 2
    expect(slotMultiplier(-5)).toBe(1);
  });

  it('honours a custom tuning object', () => {
    expect(slotMultiplier(2, { perLevel: 0.1 })).toBeCloseTo(1.2, 10);
  });
});

describe('pointsEarned', () => {
  it('counts distinct first-cleared boss floors', () => {
    expect(pointsEarned({ 5: 1, 10: 1, 15: 1 })).toBe(3);
  });

  it('is 0 for an empty / missing / non-object ledger', () => {
    expect(pointsEarned({})).toBe(0);
    expect(pointsEarned(null)).toBe(0);
    expect(pointsEarned(undefined)).toBe(0);
    expect(pointsEarned(42)).toBe(0);
  });
});

describe('pointsSpent', () => {
  it('sums a set\'s slot levels', () => {
    expect(pointsSpent({ weapon: 3, chest: 2, head: 0 })).toBe(5);
  });

  it('ignores zero / negative / non-numeric entries', () => {
    expect(pointsSpent({ weapon: 2, chest: -1, head: 'x', legs: 0 })).toBe(2);
  });

  it('is 0 for an empty / missing set', () => {
    expect(pointsSpent({})).toBe(0);
    expect(pointsSpent(null)).toBe(0);
    expect(pointsSpent(undefined)).toBe(0);
  });
});

describe('pointsAvailable — the two sets draw the pool independently', () => {
  const earned = { 5: 1, 10: 1, 15: 1, 20: 1 }; // 4 earned

  it('subtracts only THIS set\'s spend from earned', () => {
    const set0 = { weapon: 3 };
    const set1 = { chest: 1 };
    // Spending 3 in set 0 leaves set 1 with the FULL pool minus its own 1.
    expect(pointsAvailable(earned, set0)).toBe(1);
    expect(pointsAvailable(earned, set1)).toBe(3);
  });

  it('lets each set spend the full earned pool', () => {
    const full = { weapon: 4 };
    expect(pointsAvailable(earned, full)).toBe(0);
    // The other set is untouched by that — still has all 4.
    expect(pointsAvailable(earned, {})).toBe(4);
  });

  it('never goes negative even if a set is over-spent', () => {
    expect(pointsAvailable(earned, { weapon: 99 })).toBe(0);
  });
});

describe('totalLevelsInvested', () => {
  it('sums levels across BOTH sets', () => {
    expect(totalLevelsInvested([{ weapon: 3 }, { chest: 2, head: 1 }])).toBe(6);
  });

  it('is 0 for empty sets or a non-array', () => {
    expect(totalLevelsInvested([{}, {}])).toBe(0);
    expect(totalLevelsInvested(null)).toBe(0);
    expect(totalLevelsInvested(undefined)).toBe(0);
  });
});

describe('respecCost — steep by design', () => {
  it('is the base with nothing invested', () => {
    expect(respecCost([{}, {}])).toBe(BOSS_SLOTS.respecBase);
  });

  it('adds respecPerLevel per invested level across both sets', () => {
    const levels = [{ weapon: 3 }, { chest: 2 }]; // 5 total
    expect(respecCost(levels)).toBe(BOSS_SLOTS.respecBase + BOSS_SLOTS.respecPerLevel * 5);
  });

  it('honours a custom tuning object', () => {
    const t = { respecBase: 100, respecPerLevel: 10 };
    expect(respecCost([{ weapon: 2 }, {}], t)).toBe(120);
  });
});

describe('sanitizeSlotLevels', () => {
  it('normalizes to exactly two sets with every slot key present', () => {
    const out = sanitizeSlotLevels(undefined, SLOT_KEYS);
    expect(out).toHaveLength(2);
    for (const k of SLOT_KEYS) {
      expect(out[0][k]).toBe(0);
      expect(out[1][k]).toBe(0);
    }
  });

  it('keeps valid integer levels and drops unknown keys', () => {
    const out = sanitizeSlotLevels([{ weapon: 3, bogus: 9 }, { chest: 1 }], SLOT_KEYS);
    expect(out[0].weapon).toBe(3);
    expect(out[0]).not.toHaveProperty('bogus');
    expect(out[1].chest).toBe(1);
    expect(out[1].weapon).toBe(0);
  });

  it('coerces fractional / negative / non-numeric levels to a clean integer or 0', () => {
    const out = sanitizeSlotLevels([{ weapon: 2.8, chest: -4, head: 'x' }, null], SLOT_KEYS);
    expect(out[0].weapon).toBe(2);
    expect(out[0].chest).toBe(0);
    expect(out[0].head).toBe(0);
    expect(out[1].weapon).toBe(0);
  });

  it('tolerates a non-array blob (old saves) and empty slot keys', () => {
    expect(sanitizeSlotLevels(42, SLOT_KEYS)).toHaveLength(2);
    expect(sanitizeSlotLevels(undefined, undefined)).toEqual([{}, {}]);
  });
});
