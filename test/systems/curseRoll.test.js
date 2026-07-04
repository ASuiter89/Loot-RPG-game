import { describe, it, expect } from 'vitest';
import {
  CURSE_STAT_MULT,
  isTinyCurseStat,
  tinyCurseSwing,
  statCurseSwing,
  cursedStatCeiling,
} from '../../src/systems/curseRoll.js';

describe('isTinyCurseStat', () => {
  it('flags only crit chance and luck (the 0–100% chances)', () => {
    expect(isTinyCurseStat('CRIT')).toBe(true);
    expect(isTinyCurseStat('LCK')).toBe(true);
  });
  it('does not flag ordinary stats — they take the stat-relative swing', () => {
    for (const s of ['ATKSPD', 'IDMG', 'LEECH', 'HP', 'ATK', 'CRITDMG', 'SPELLPWR']) {
      expect(isTinyCurseStat(s)).toBe(false);
    }
  });
});

describe('tinyCurseSwing', () => {
  it('stays clamped to 1..5 however deep or rare the item', () => {
    expect(tinyCurseSwing(1, 1)).toBeGreaterThanOrEqual(1);
    expect(tinyCurseSwing(117, 3.2)).toBe(5);   // deep + legendary still capped at 5
    expect(tinyCurseSwing(200, 5)).toBe(5);
  });
  it('is at least 1 at the shallowest end', () => {
    expect(tinyCurseSwing(0, 0)).toBe(1);
  });
});

describe('statCurseSwing', () => {
  it('is the stat\'s normal ceiling times the curse multiplier', () => {
    expect(statCurseSwing(15)).toBe(Math.round(15 * CURSE_STAT_MULT)); // ATKSPD cap 15
    expect(statCurseSwing(8)).toBe(Math.round(8 * CURSE_STAT_MULT));   // LEECH cap 8
  });
  it('scales with the stat, so a big-number stat gets a big swing and a small one a small swing', () => {
    // A ~300% attack-speed roll (normalMax 15) is impossible now: the swing is bounded.
    expect(statCurseSwing(15)).toBeLessThan(60);
    // A pool stat like HP (normalMax ~480 at deep ilvl) naturally gets a large swing.
    expect(statCurseSwing(480)).toBeGreaterThan(statCurseSwing(15));
  });
  it('honours a custom multiplier', () => {
    expect(statCurseSwing(20, 3)).toBe(60);
  });
  it('never drops below 1, even at a zero ceiling', () => {
    expect(statCurseSwing(0)).toBe(1);
    expect(statCurseSwing(-5)).toBe(1);
  });
});

describe('cursedStatCeiling', () => {
  it('is a full normal roll plus one curse swing — the max a cursed stat can now reach', () => {
    const nm = 15;
    expect(cursedStatCeiling(nm)).toBe(Math.round(nm) + statCurseSwing(nm));
  });
  it('keeps a low-cap percent stat far below the old runaway values', () => {
    // ATKSPD at ilvl 117 had normalMax 15; ceiling is tens of %, not the old ~300.
    expect(cursedStatCeiling(15)).toBeLessThan(60);
  });
  it('always exceeds a single swing, so a fresh cursed roll never trips the repair clamp', () => {
    for (const nm of [8, 12, 15, 25, 100, 480]) {
      expect(cursedStatCeiling(nm)).toBeGreaterThan(statCurseSwing(nm));
    }
  });
});
