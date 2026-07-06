import { describe, it, expect } from 'vitest';
import { CYCLE_MODIFIERS } from '../../src/data/cycleModifiers.js';
import {
  resolveModifier,
  modifierEnemyAffix,
  applyLootTierShift,
  applyPayoutMult,
  applyDensityMult,
  applyXpMult,
} from '../../src/systems/cycleModifiers.js';

const NEUTRAL = { lootTierShift: 0, bountyPayoutMult: 1, enemyAffix: null, densityMult: 1, xpMult: 1 };

describe('resolveModifier', () => {
  it('resolves a known id to its normalized params (defaults filled)', () => {
    // 'gilded' sets only payout + xp; the rest come back at their neutral defaults.
    expect(resolveModifier('gilded')).toEqual({
      lootTierShift: 0, bountyPayoutMult: 1.5, enemyAffix: null, densityMult: 1, xpMult: 1.1,
    });
    // 'volatile' sets affix + tier shift + xp.
    expect(resolveModifier('volatile')).toEqual({
      lootTierShift: 1, bountyPayoutMult: 1, enemyAffix: 'volatile', densityMult: 1, xpMult: 1.25,
    });
  });

  it('returns the neutral shape for the "open" baseline', () => {
    expect(resolveModifier('open')).toEqual(NEUTRAL);
  });

  it('returns neutral for an unknown / falsy id or bad table', () => {
    expect(resolveModifier('nope')).toEqual(NEUTRAL);
    expect(resolveModifier(null)).toEqual(NEUTRAL);
    expect(resolveModifier(undefined)).toEqual(NEUTRAL);
    expect(resolveModifier('gilded', 42)).toEqual(NEUTRAL);
  });

  it('never returns the shared data object (caller can mutate freely)', () => {
    const gildedRow = CYCLE_MODIFIERS.find((m) => m.id === 'gilded');
    const p = resolveModifier('gilded');
    p.bountyPayoutMult = 999;
    expect(gildedRow.params.bountyPayoutMult).toBe(1.5); // untouched
  });

  it('honours a custom data table and coerces garbage knob values', () => {
    const data = [{ id: 'x', params: { lootTierShift: 2.9, bountyPayoutMult: 'oops', enemyAffix: 42, densityMult: NaN, xpMult: 3 } }];
    expect(resolveModifier('x', data)).toEqual({
      lootTierShift: 2,      // truncated
      bountyPayoutMult: 1,   // non-finite → default
      enemyAffix: null,      // non-string → null
      densityMult: 1,        // NaN → default
      xpMult: 3,
    });
  });

  it('every shipped cycle modifier resolves without throwing', () => {
    for (const m of CYCLE_MODIFIERS) {
      const p = resolveModifier(m.id);
      expect(Number.isFinite(p.bountyPayoutMult)).toBe(true);
      expect(Number.isInteger(p.lootTierShift)).toBe(true);
    }
  });
});

describe('modifierEnemyAffix', () => {
  it('reads the resolved affix', () => {
    expect(modifierEnemyAffix('swarm')).toBe('frenzied');
    expect(modifierEnemyAffix('ironblood')).toBe('armored');
    expect(modifierEnemyAffix('gilded')).toBeNull();
    expect(modifierEnemyAffix('nope')).toBeNull();
  });
});

describe('applyLootTierShift', () => {
  const base = [10, 20, 30, 40]; // 4 rarity tiers, total weight 100

  it('a zero shift returns a copy with identical weights', () => {
    const out = applyLootTierShift(base, 0);
    expect(out).toEqual(base);
    expect(out).not.toBe(base); // fresh array
  });

  it('shifts weight up toward higher rarity, conserving total mass', () => {
    const out = applyLootTierShift(base, 1);
    // index i → i+1; the top tier's weight (40) piles onto the last slot.
    expect(out).toEqual([0, 10, 20, 70]);
    expect(out.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('shifts down toward lower rarity, piling underflow on tier 0', () => {
    const out = applyLootTierShift(base, -1);
    expect(out).toEqual([30, 30, 40, 0]);
    expect(out.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('a huge shift collapses all mass onto the boundary tier', () => {
    expect(applyLootTierShift(base, 99)).toEqual([0, 0, 0, 100]);
    expect(applyLootTierShift(base, -99)).toEqual([100, 0, 0, 0]);
  });

  it('truncates a fractional shift and treats garbage as 0', () => {
    expect(applyLootTierShift(base, 1.9)).toEqual(applyLootTierShift(base, 1));
    expect(applyLootTierShift(base, NaN)).toEqual(base);
    expect(applyLootTierShift(base, undefined)).toEqual(base);
  });

  it('coerces non-numeric weights to 0 and returns [] for a non-array', () => {
    expect(applyLootTierShift([5, 'x', 5], 0)).toEqual([5, 0, 5]);
    expect(applyLootTierShift(null, 1)).toEqual([]);
    expect(applyLootTierShift(42, 1)).toEqual([]);
  });
});

describe('applyPayoutMult', () => {
  it('multiplies and floors to whole gold', () => {
    expect(applyPayoutMult(100, 1.5)).toBe(150);
    expect(applyPayoutMult(101, 1.5)).toBe(151); // floor(151.5)
  });
  it('defaults a missing multiplier to 1 and clamps negatives to 0', () => {
    expect(applyPayoutMult(100, undefined)).toBe(100);
    expect(applyPayoutMult(100, -2)).toBe(0);
  });
  it('treats a non-finite base as 0', () => {
    expect(applyPayoutMult(NaN, 2)).toBe(0);
    expect(applyPayoutMult(-50, 2)).toBe(0); // base clamped ≥ 0
  });
});

describe('applyDensityMult', () => {
  it('multiplies and rounds spawn counts', () => {
    expect(applyDensityMult(10, 1.4)).toBe(14);
    expect(applyDensityMult(10, 1.45)).toBe(15); // round(14.5)
  });
  it('defaults / clamps and floors at 0', () => {
    expect(applyDensityMult(10, undefined)).toBe(10);
    expect(applyDensityMult(10, -1)).toBe(0);
    expect(applyDensityMult(NaN, 2)).toBe(0);
  });
});

describe('applyXpMult', () => {
  it('multiplies and floors xp', () => {
    expect(applyXpMult(200, 1.25)).toBe(250);
    expect(applyXpMult(201, 1.25)).toBe(251); // floor(251.25)
  });
  it('defaults / clamps / handles garbage base', () => {
    expect(applyXpMult(200, undefined)).toBe(200);
    expect(applyXpMult(200, -3)).toBe(0);
    expect(applyXpMult('x', 2)).toBe(0);
  });
});
