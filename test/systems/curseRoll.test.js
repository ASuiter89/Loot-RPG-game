import { describe, it, expect } from 'vitest';
import {
  CURSE_TIER_MULT,
  curseTierMult,
  statCurseSwing,
  cursedStatCeiling,
} from '../../src/systems/curseRoll.js';

describe('CURSE_TIER_MULT', () => {
  it('ramps from 2.2x (uncommon) to 5x (legendary)', () => {
    expect(CURSE_TIER_MULT.uncommon).toBe(2.2);
    expect(CURSE_TIER_MULT.legendary).toBe(5.0);
    // strictly increasing across the cursable tiers
    expect(CURSE_TIER_MULT.uncommon).toBeLessThan(CURSE_TIER_MULT.rare);
    expect(CURSE_TIER_MULT.rare).toBeLessThan(CURSE_TIER_MULT.epic);
    expect(CURSE_TIER_MULT.epic).toBeLessThan(CURSE_TIER_MULT.legendary);
  });
});

describe('curseTierMult', () => {
  it('returns each cursable tier\'s multiplier', () => {
    expect(curseTierMult('uncommon')).toBe(2.2);
    expect(curseTierMult('rare')).toBe(2.9);
    expect(curseTierMult('epic')).toBe(3.8);
    expect(curseTierMult('legendary')).toBe(5.0);
  });
  it('falls back to the gentlest tier for anything not cursable', () => {
    // junk/normal/unique never actually get cursed, but the fallback must be safe.
    expect(curseTierMult('unique')).toBe(2.2);
    expect(curseTierMult(undefined)).toBe(2.2);
  });
});

describe('statCurseSwing', () => {
  it('is the stat\'s normal ceiling times the tier multiplier', () => {
    expect(statCurseSwing(15, 2.2)).toBe(Math.round(15 * 2.2)); // uncommon ATKSPD
    expect(statCurseSwing(45, 5.0)).toBe(Math.round(45 * 5.0)); // legendary ATKSPD
  });
  it('grows with rarity for the same stat', () => {
    const nm = 30;
    expect(statCurseSwing(nm, curseTierMult('legendary')))
      .toBeGreaterThan(statCurseSwing(nm, curseTierMult('uncommon')));
  });
  it('scales with the stat, so a big-number stat gets a big swing and a small one a small swing', () => {
    expect(statCurseSwing(480, 5)).toBeGreaterThan(statCurseSwing(20, 5));
  });
  it('never drops below 1, even at a zero or negative ceiling', () => {
    expect(statCurseSwing(0, 5)).toBe(1);
    expect(statCurseSwing(-5, 5)).toBe(1);
  });
});

describe('cursedStatCeiling', () => {
  it('is a full normal roll plus one curse swing — the max a cursed stat can reach', () => {
    const nm = 45, cm = 5.0;
    expect(cursedStatCeiling(nm, cm)).toBe(Math.round(nm) + statCurseSwing(nm, cm));
  });
  it('rises with rarity, so a legendary ceiling exceeds an uncommon one', () => {
    const nm = 20;
    expect(cursedStatCeiling(nm, curseTierMult('legendary')))
      .toBeGreaterThan(cursedStatCeiling(nm, curseTierMult('uncommon')));
  });
  it('always exceeds a single swing, so a fresh cursed roll never trips the repair clamp', () => {
    for (const nm of [8, 15, 25, 45, 100, 480]) {
      expect(cursedStatCeiling(nm, 5)).toBeGreaterThan(statCurseSwing(nm, 5));
    }
  });
});
