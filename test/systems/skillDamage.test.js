import { describe, it, expect } from 'vitest';
import {
  MIN_SKILL_CD, castHaste, effectiveCooldown, castsPerSecond,
  critAverageMult, averageHitDamage, effectiveDps,
} from '../../src/systems/skillDamage.js';

describe('castHaste', () => {
  it('is 1.0 with no stats', () => {
    expect(castHaste()).toBe(1);
    expect(castHaste({})).toBe(1);
  });
  it('adds Cooldown Reduction for every active', () => {
    expect(castHaste({ cdr: 50 })).toBeCloseTo(1.5, 10);
  });
  it('layers Cast Speed only on spells', () => {
    expect(castHaste({ cdr: 0, castSpd: 20, isSpell: false })).toBe(1);
    expect(castHaste({ cdr: 0, castSpd: 20, isSpell: true })).toBeCloseTo(1.2, 10);
    // Stacks multiplicatively with CDR.
    expect(castHaste({ cdr: 50, castSpd: 20, isSpell: true })).toBeCloseTo(1.5 * 1.2, 10);
  });
  it('adds the legacy Honed (rank 7) factor', () => {
    expect(castHaste({ honed: true })).toBeCloseTo(1.2, 10);
    expect(castHaste({ cdr: 100, honed: true })).toBeCloseTo(2 * 1.2, 10);
  });
  it('adds a per-archetype milestone surge factor', () => {
    expect(castHaste({ surge: 0.2 })).toBeCloseTo(1.2, 10);
    expect(castHaste({ surge: 0 })).toBe(1);
    // stacks multiplicatively with CDR, like the recharge pipeline
    expect(castHaste({ cdr: 100, surge: 0.35 })).toBeCloseTo(2 * 1.35, 10);
  });
  it('ignores negative stats', () => {
    expect(castHaste({ cdr: -50 })).toBe(1);
    expect(castHaste({ castSpd: -50, isSpell: true })).toBe(1);
    expect(castHaste({ surge: -0.5 })).toBe(1);
  });
});

describe('effectiveCooldown', () => {
  it('divides the base cooldown by haste', () => {
    expect(effectiveCooldown(9, 1)).toBe(9);
    expect(effectiveCooldown(9, 1.5)).toBeCloseTo(6, 10);
  });
  it('floors at MIN_SKILL_CD', () => {
    expect(effectiveCooldown(0.4, 1)).toBe(MIN_SKILL_CD);
    expect(effectiveCooldown(1, 100)).toBe(MIN_SKILL_CD);
    expect(effectiveCooldown(0, 1)).toBe(MIN_SKILL_CD);
    expect(effectiveCooldown(undefined, 1)).toBe(MIN_SKILL_CD);
  });
  it('treats non-positive haste as 1', () => {
    expect(effectiveCooldown(4, 0)).toBe(4);
  });
});

describe('castsPerSecond', () => {
  it('is the reciprocal of the effective cooldown', () => {
    expect(castsPerSecond(4, 1)).toBeCloseTo(0.25, 10);
    expect(castsPerSecond(2, 2)).toBeCloseTo(1, 10);
  });
  it('caps at 2/sec via the 0.5s floor', () => {
    expect(castsPerSecond(0.1, 1)).toBeCloseTo(2, 10);
  });
});

describe('critAverageMult', () => {
  it('is 1.0 with no crit chance', () => {
    expect(critAverageMult(0, 2)).toBe(1);
  });
  it('blends the crit multiplier by chance', () => {
    // 25% chance to double → +25% average.
    expect(critAverageMult(0.25, 2)).toBeCloseTo(1.25, 10);
    // 50% chance for 3× → +100% average.
    expect(critAverageMult(0.5, 3)).toBeCloseTo(2, 10);
  });
  it('clamps chance into 0..1', () => {
    expect(critAverageMult(-1, 2)).toBe(1);
    expect(critAverageMult(5, 2)).toBeCloseTo(2, 10); // full crit → the multiplier
  });
});

describe('averageHitDamage', () => {
  it('averages the span then applies crit', () => {
    expect(averageHitDamage(10, 20, 0, 2)).toBeCloseTo(15, 10);
    expect(averageHitDamage(10, 20, 0.5, 2)).toBeCloseTo(15 * 1.5, 10);
  });
  it('handles a fixed-damage span (min === max)', () => {
    expect(averageHitDamage(40, 40, 0, 2)).toBeCloseTo(40, 10);
  });
});

describe('effectiveDps', () => {
  it('is average hit × hits × casts/sec', () => {
    // avg 15, no crit, single hit, 4s cd @ haste 1 → 0.25 casts/sec → 3.75 dps.
    const cps = castsPerSecond(4, 1);
    expect(effectiveDps({ min: 10, max: 20, critChance: 0, critMult: 2, castsPerSec: cps }))
      .toBeCloseTo(15 * 0.25, 10);
  });
  it('multiplies by hits-per-cast for multi-strike skills', () => {
    const cps = castsPerSecond(2, 1); // 0.5/sec
    const one = effectiveDps({ min: 10, max: 10, critChance: 0, critMult: 2, hitsPerCast: 1, castsPerSec: cps });
    const three = effectiveDps({ min: 10, max: 10, critChance: 0, critMult: 2, hitsPerCast: 3, castsPerSec: cps });
    expect(three).toBeCloseTo(one * 3, 10);
  });
  it('folds crit into the sustained number', () => {
    const cps = castsPerSecond(0.5, 1); // 0.5s cd → 2/sec
    // avg hit 100 * 1.5 (50% crit for 2x) * 1 hit * 2/sec = 300.
    expect(effectiveDps({ min: 100, max: 100, critChance: 0.5, critMult: 2, castsPerSec: cps }))
      .toBeCloseTo(300, 10);
  });
  it('treats a missing hits-per-cast as one', () => {
    const cps = castsPerSecond(5, 1);
    expect(effectiveDps({ min: 50, max: 50, critChance: 0, critMult: 2, castsPerSec: cps }))
      .toBeCloseTo(averageHitDamage(50, 50, 0, 2) * cps, 10);
  });
});
