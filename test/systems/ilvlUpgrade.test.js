import { describe, it, expect } from 'vitest';
import {
  tierFactor,
  upgradeOptions,
  upgradeCost,
  headlineFactor,
  scaleHeadline,
  projectAffix,
} from '../../src/systems/ilvlUpgrade.js';
import { ILVL_UPGRADE } from '../../src/data/ilvlUpgradeTuning.js';

// Rarity ranks (index into TIERS): 0 junk, 1 normal … 6 unique.
const JUNK = 0, NORMAL = 1, RARE = 3, EPIC = 4, UNIQUE = 6;

describe('tierFactor', () => {
  it('is 1 at rank 0 and climbs a fixed step per rank', () => {
    expect(tierFactor(0)).toBe(1);
    expect(tierFactor(1)).toBeCloseTo(1 + ILVL_UPGRADE.tierFactorStep);
    expect(tierFactor(RARE)).toBeCloseTo(1 + RARE * ILVL_UPGRADE.tierFactorStep);
  });
  it('is strictly increasing with rank and never below 1', () => {
    for (let r = 1; r <= UNIQUE; r++) expect(tierFactor(r)).toBeGreaterThan(tierFactor(r - 1));
    expect(tierFactor(-3)).toBe(1); // clamps a bogus negative rank
  });
});

describe('upgradeOptions', () => {
  it('offers +1, +10 and the cap when there is ample headroom', () => {
    const opts = upgradeOptions(5, 40);
    expect(opts.map(o => o.to)).toEqual([6, 15, 40]);
    expect(opts.map(o => o.step)).toEqual([1, 10, 35]);
    expect(opts.map(o => o.atCap)).toEqual([false, false, true]);
  });

  it('returns nothing when already at or beyond the cap', () => {
    expect(upgradeOptions(40, 40)).toEqual([]);
    expect(upgradeOptions(41, 40)).toEqual([]);
  });

  it('collapses to a single capped option when only +1 fits', () => {
    const opts = upgradeOptions(5, 6);
    expect(opts).toEqual([{ to: 6, step: 1, atCap: true }]);
  });

  it('labels a clamped +10 by its ACTUAL step and marks it as the cap', () => {
    // from 5, cap 8: +1 → 6, +10 clamps to 8 (== cap), the explicit cap dedupes away.
    const opts = upgradeOptions(5, 8);
    expect(opts).toEqual([
      { to: 6, step: 1, atCap: false },
      { to: 8, step: 3, atCap: true },
    ]);
  });

  it('de-duplicates when +10 lands exactly on the cap', () => {
    const opts = upgradeOptions(5, 15);
    expect(opts).toEqual([
      { to: 6, step: 1, atCap: false },
      { to: 15, step: 10, atCap: true },
    ]);
  });

  it('sanitises fractional / bogus inputs', () => {
    expect(upgradeOptions(5.9, 6.9)).toEqual([{ to: 6, step: 1, atCap: true }]);
    expect(upgradeOptions(0, 3)).toEqual([{ to: 2, step: 1, atCap: false }, { to: 3, step: 2, atCap: true }]);
  });
});

describe('upgradeCost', () => {
  it('charges only gold + scrap below the core rank', () => {
    const c = upgradeCost({ rank: NORMAL, fromIlvl: 5, toIlvl: 6 });
    expect(c.gold).toBeGreaterThan(0);
    expect(c.scrap).toBeGreaterThanOrEqual(1);
    expect(c.core).toBeUndefined();
  });

  it('adds a Core on rare+ gear', () => {
    const c = upgradeCost({ rank: RARE, fromIlvl: 10, toIlvl: 11 });
    expect(c.core).toBeGreaterThanOrEqual(1);
  });

  it('costs nothing extra for a no-op (target ≤ current)', () => {
    expect(upgradeCost({ rank: EPIC, fromIlvl: 10, toIlvl: 10 })).toEqual({ gold: 0, scrap: 1 });
    expect(upgradeCost({ rank: EPIC, fromIlvl: 10, toIlvl: 8 })).toEqual({ gold: 0, scrap: 1 });
  });

  it('spans the single-level steps it covers (within rounding)', () => {
    const rank = RARE;
    const oneStep = (from, to) => upgradeCost({ rank, fromIlvl: from, toIlvl: to });
    const a = oneStep(10, 11).gold, b = oneStep(11, 12).gold;
    const jump = oneStep(10, 12).gold;
    // Gold is summed then rounded once, so a two-step jump matches its parts to ±1.
    expect(Math.abs(jump - (a + b))).toBeLessThanOrEqual(1);
    expect(oneStep(10, 12).scrap).toBeGreaterThan(oneStep(10, 11).scrap);
  });

  it('climbs with rarity and with the depth reached', () => {
    const lowRare = upgradeCost({ rank: RARE, fromIlvl: 5, toIlvl: 6 }).gold;
    const highRare = upgradeCost({ rank: RARE, fromIlvl: 25, toIlvl: 26 }).gold;
    const highUnique = upgradeCost({ rank: UNIQUE, fromIlvl: 25, toIlvl: 26 }).gold;
    expect(highRare).toBeGreaterThan(lowRare);       // deeper costs more
    expect(highUnique).toBeGreaterThan(highRare);    // rarer costs more
  });

  it('a bigger jump costs strictly more than a smaller one from the same base', () => {
    const plus1 = upgradeCost({ rank: EPIC, fromIlvl: 10, toIlvl: 11 }).gold;
    const plus10 = upgradeCost({ rank: EPIC, fromIlvl: 10, toIlvl: 20 }).gold;
    expect(plus10).toBeGreaterThan(plus1 * 9); // super-linear: deeper levels in the jump cost more
  });
});

describe('scaleHeadline', () => {
  it('grows a value by the ratio of the two curve factors', () => {
    const from = headlineFactor('DMG', 10), to = headlineFactor('DMG', 20);
    expect(scaleHeadline(100, from, to)).toBe(Math.round(100 * to / from));
  });
  it('never drops below 1 or below the current value', () => {
    expect(scaleHeadline(1, 5, 5)).toBe(1);
    // equal factors → unchanged (never shrinks on a rounding wobble)
    const f = headlineFactor('DEF', 8);
    expect(scaleHeadline(7, f, f)).toBe(7);
  });
  it('is a no-op on a zero/invalid from-factor', () => {
    expect(scaleHeadline(9, 0, 4)).toBe(9);
  });
});

describe('headlineFactor', () => {
  it('follows the tuned slope per role and rises with level', () => {
    const s = ILVL_UPGRADE.headlineSlopes.DMG;
    expect(headlineFactor('DMG', 10)).toBeCloseTo(s.base + 10 * s.per);
    expect(headlineFactor('DEF', 20)).toBeGreaterThan(headlineFactor('DEF', 10));
  });
  it('returns a neutral factor for an unknown role', () => {
    expect(headlineFactor('NOPE', 10)).toBe(1);
  });
});

describe('projectAffix', () => {
  it('preserves relative roll quality (value ÷ band-max)', () => {
    // A max roll stays a max roll after empowering.
    expect(projectAffix(10, 10, 18, 11)).toBe(18);
    // A mid roll keeps its position: 6/10 → ~11/18.
    expect(projectAffix(6, 10, 18, 6)).toBe(Math.round(6 * 18 / 10));
  });

  it('never lets a positive value shrink and floors it at the new minimum', () => {
    // A weak roll below the new floor is lifted up to it.
    expect(projectAffix(2, 10, 18, 8)).toBe(8);
    // Never below the current value even if maths would round it there.
    expect(projectAffix(9, 9, 9, 0)).toBe(9);
  });

  it('scales a negative curse penalty MORE negative in step (no positive floor)', () => {
    expect(projectAffix(-10, 10, 18, 11)).toBe(-18);
  });

  it('is a no-op on a zero/invalid from-max', () => {
    expect(projectAffix(5, 0, 12, 3)).toBe(5);
  });

  it('is monotonic: a positive value never decreases across a real band growth', () => {
    for (let v = 1; v <= 20; v++) {
      const up = projectAffix(v, 12, 20, 8);
      expect(up).toBeGreaterThanOrEqual(v);
    }
  });
});
