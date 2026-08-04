import { describe, it, expect } from 'vitest';
import {
  SPECIAL_KIND_KEYS,
  specialItemDef,
  specialChancePct,
  fortuneStats,
  eligibleSpecialKinds,
  rollSpecialKind,
  fortuneTierMult,
  fortuneStatValue,
  deepforgeIlvl,
  storiedStatCount,
} from '../../src/systems/specialItems.js';
import {
  SPECIAL_ITEM_KINDS,
  FORTUNE_STATS,
  FORTUNE_TIER_MULT,
  DEEPFORGE_ILVL,
  STORIED_EXTRA_STATS,
} from '../../src/data/specialItems.js';
import { curseTierMult, cursedStatCeiling } from '../../src/systems/curseRoll.js';

// Realistic slot pools (mirrors SLOT_AFFIX_POOLS in the shell) for eligibility tests.
const WEAPON_POOL = ['ATK', 'ACC', 'CRIT', 'CRITDMG', 'IDMG', 'DBLSTRIKE', 'BOSSDMG', 'PEN', 'ATKSPD'];
const RING_POOL   = ['CRIT', 'ATK', 'IDMG', 'GOLDFIND', 'MAGICFIND', 'HP', 'MP', 'DEF'];
const LEGS_POOL   = ['SPD', 'HP', 'REGEN', 'DODGE', 'DR', 'GOLDFIND', 'XPGAIN'];
const HEAD_POOL   = ['HP', 'MP', 'REGEN', 'CRIT', 'SPD', 'MAGICFIND', 'XPGAIN', 'CDR'];

describe('SPECIAL_ITEM_KINDS', () => {
  it('holds the four kinds, each with the art + copy every display needs', () => {
    expect(SPECIAL_KIND_KEYS).toEqual(['cursed', 'fortunate', 'deepforged', 'storied']);
    for (const k of SPECIAL_KIND_KEYS) {
      const d = SPECIAL_ITEM_KINDS[k];
      expect(d.weight).toBeGreaterThan(0);
      expect(typeof d.label).toBe('string');
      expect(typeof d.sprite).toBe('string');   // an atlas tile — never an emoji
      expect(d.sprite).toMatch(/^[a-z_]+$/);
      expect(typeof d.flavor).toBe('string');
      expect(typeof d.blurb).toBe('string');
      expect(d.valueMult).toBeGreaterThan(1);   // a special piece is worth more gold
    }
  });

  it('keeps cursed the most common kind, so the new three still read as rarer finds', () => {
    for (const k of ['fortunate', 'deepforged', 'storied']) {
      expect(SPECIAL_ITEM_KINDS[k].weight).toBeLessThan(SPECIAL_ITEM_KINDS.cursed.weight);
    }
  });

  it('leaves most drops plain — the whole family is well under half of eligible gear', () => {
    expect(specialChancePct()).toBe(22);
    expect(specialChancePct()).toBeLessThan(50);
  });
});

describe('specialItemDef', () => {
  it('returns the tuning row for a real kind', () => {
    expect(specialItemDef('fortunate').label).toBe('Fortunate');
  });
  it('returns null for anything that is not a kind', () => {
    expect(specialItemDef('radiant')).toBe(null);
    expect(specialItemDef(undefined)).toBe(null);
    expect(specialItemDef(null)).toBe(null);
  });
});

describe('specialChancePct', () => {
  it('sums only the kinds on the table', () => {
    expect(specialChancePct(['cursed'])).toBe(SPECIAL_ITEM_KINDS.cursed.weight);
    expect(specialChancePct([])).toBe(0);
    expect(specialChancePct(['nope'])).toBe(0);
  });
});

describe('fortuneStats', () => {
  it('finds the finder stats a pool allows', () => {
    expect(fortuneStats(RING_POOL)).toEqual(['GOLDFIND', 'MAGICFIND']);
    expect(fortuneStats(LEGS_POOL)).toEqual(['GOLDFIND']);
    expect(fortuneStats(HEAD_POOL)).toEqual(['MAGICFIND']);
  });
  it('is empty for a pool with neither, and safe on a missing pool', () => {
    expect(fortuneStats(WEAPON_POOL)).toEqual([]);
    expect(fortuneStats(undefined)).toEqual([]);
  });
  it('only ever offers ECONOMY stats — a fortunate roll can never buy combat power', () => {
    for (const s of fortuneStats(RING_POOL)) expect(FORTUNE_STATS).toContain(s);
  });
});

describe('eligibleSpecialKinds', () => {
  it('offers every kind where a finder stat can land', () => {
    expect(eligibleSpecialKinds(RING_POOL)).toEqual(SPECIAL_KIND_KEYS);
  });
  it('drops ONLY fortunate from a pool with no finder stat', () => {
    const kinds = eligibleSpecialKinds(WEAPON_POOL);
    expect(kinds).not.toContain('fortunate');
    expect(kinds).toEqual(['cursed', 'deepforged', 'storied']);
  });
  it('leaves the other kinds at their own absolute rate rather than re-weighting', () => {
    // A weapon is simply less special overall — it never becomes over-cursed to compensate.
    expect(specialChancePct(eligibleSpecialKinds(WEAPON_POOL)))
      .toBeLessThan(specialChancePct(eligibleSpecialKinds(RING_POOL)));
  });
});

describe('rollSpecialKind', () => {
  it('maps the roll onto the weight bands in declaration order', () => {
    expect(rollSpecialKind(() => 0.00)).toBe('cursed');       // 0 → first band
    expect(rollSpecialKind(() => 0.119)).toBe('cursed');      // 11.9% → still cursed (12 wide)
    expect(rollSpecialKind(() => 0.12)).toBe('fortunate');    // 12% → next band
    expect(rollSpecialKind(() => 0.159)).toBe('fortunate');
    expect(rollSpecialKind(() => 0.16)).toBe('deepforged');
    expect(rollSpecialKind(() => 0.19)).toBe('storied');
  });

  it('returns null past the last band — most drops are plain', () => {
    expect(rollSpecialKind(() => 0.22)).toBe(null);
    expect(rollSpecialKind(() => 0.5)).toBe(null);
    expect(rollSpecialKind(() => 0.999)).toBe(null);
  });

  it('never returns a kind that was not offered', () => {
    const kinds = eligibleSpecialKinds(WEAPON_POOL);
    for (let i = 0; i < 100; i++) {
      const got = rollSpecialKind(() => i / 100, kinds);
      if (got) expect(kinds).toContain(got);
    }
  });

  it('closes the gap an ineligible kind leaves, so no roll falls into a dead band', () => {
    // With fortunate off the table, its 4 points go to the kinds AFTER it, not to null.
    const kinds = eligibleSpecialKinds(WEAPON_POOL);
    expect(rollSpecialKind(() => 0.12, kinds)).toBe('deepforged');
    expect(rollSpecialKind(() => 0.15, kinds)).toBe('storied');
    expect(rollSpecialKind(() => 0.18, kinds)).toBe(null);
  });

  it('is safe with no rng at all (never invents a special)', () => {
    expect(rollSpecialKind(undefined)).toBe(null);
    expect(rollSpecialKind(null)).toBe(null);
  });

  it('produces roughly its stated rate over a uniform sweep', () => {
    let special = 0;
    for (let i = 0; i < 1000; i++) if (rollSpecialKind(() => i / 1000)) special++;
    expect(special).toBe(specialChancePct() * 10);   // 22% of 1000
  });
});

describe('fortuneTierMult', () => {
  it('ramps across the rollable tiers', () => {
    expect(fortuneTierMult('uncommon')).toBe(2.5);
    expect(fortuneTierMult('legendary')).toBe(5.5);
    expect(FORTUNE_TIER_MULT.uncommon).toBeLessThan(FORTUNE_TIER_MULT.rare);
    expect(FORTUNE_TIER_MULT.rare).toBeLessThan(FORTUNE_TIER_MULT.epic);
    expect(FORTUNE_TIER_MULT.epic).toBeLessThan(FORTUNE_TIER_MULT.legendary);
  });
  it('falls back to the gentlest tier for anything not rollable', () => {
    expect(fortuneTierMult('unique')).toBe(2.5);
    expect(fortuneTierMult(undefined)).toBe(2.5);
  });
  it('runs hotter than a curse swing at every tier — nothing here wins a fight', () => {
    for (const t of ['uncommon', 'rare', 'epic', 'legendary']) {
      expect(fortuneTierMult(t)).toBeGreaterThan(curseTierMult(t));
    }
  });
});

describe('fortuneStatValue', () => {
  it('is a full normal roll PLUS a rarity-scaled swing on top', () => {
    expect(fortuneStatValue(20, 2.5)).toBe(20 + 50);
    expect(fortuneStatValue(20, 5.5)).toBe(20 + 110);
  });

  it('always beats the best ORDINARY roll of that stat — that is the whole point', () => {
    for (const normalMax of [1, 4, 12, 30, 88, 400]) {
      for (const t of ['uncommon', 'rare', 'epic', 'legendary']) {
        expect(fortuneStatValue(normalMax, fortuneTierMult(t))).toBeGreaterThan(normalMax);
      }
    }
  });

  it('grows with rarity for the same stat', () => {
    expect(fortuneStatValue(30, fortuneTierMult('legendary')))
      .toBeGreaterThan(fortuneStatValue(30, fortuneTierMult('uncommon')));
  });

  it('scales WITH the stat, so it is never out of proportion to what it lands on', () => {
    expect(fortuneStatValue(400, 5)).toBeGreaterThan(fortuneStatValue(20, 5));
  });

  it('still grants something at a zero or negative ceiling', () => {
    expect(fortuneStatValue(0, 5)).toBe(1);
    expect(fortuneStatValue(-9, 5)).toBe(1);
  });

  // The save-repair pass clamps saved stats to the most a SPECIAL roll may grant. A
  // fortunate roll out-reaches a curse swing by design, so it needs its OWN ceiling
  // there — clamping it to the curse ceiling would silently shave every fortunate
  // item on the next load. Pin the relationship so the repair can't regress to one bound.
  it('out-reaches the curse ceiling at every tier, so it needs its own save-repair bound', () => {
    for (const t of ['uncommon', 'rare', 'epic', 'legendary']) {
      for (const normalMax of [4, 16, 28, 90]) {
        expect(fortuneStatValue(normalMax, fortuneTierMult(t)))
          .toBeGreaterThan(cursedStatCeiling(normalMax, curseTierMult(t)));
      }
    }
  });
});

describe('deepforgeIlvl', () => {
  it('rolls the piece deeper than the floor that dropped it', () => {
    for (const lvl of [1, 5, 12, 40, 100, 300]) {
      expect(deepforgeIlvl(lvl)).toBeGreaterThan(lvl);
    }
  });

  it('uses the flat floor on shallow drops, where a percentage is nothing', () => {
    expect(deepforgeIlvl(1)).toBe(1 + DEEPFORGE_ILVL.min);
    expect(deepforgeIlvl(10)).toBe(10 + DEEPFORGE_ILVL.min); // 35% of 10 = 3.5 → floor wins
  });

  it('switches to the percentage once that outgrows the floor, so depth keeps mattering', () => {
    expect(deepforgeIlvl(100)).toBe(100 + Math.round(100 * DEEPFORGE_ILVL.pct));
    expect(deepforgeIlvl(300)).toBe(300 + Math.round(300 * DEEPFORGE_ILVL.pct));
  });

  it('is monotonic — a deeper find is never forged shallower', () => {
    let prev = 0;
    for (let lvl = 1; lvl <= 200; lvl++) {
      const got = deepforgeIlvl(lvl);
      expect(got).toBeGreaterThanOrEqual(prev);
      prev = got;
    }
  });

  it('clamps a missing or nonsense item level instead of producing NaN', () => {
    expect(deepforgeIlvl(0)).toBe(1 + DEEPFORGE_ILVL.min);
    expect(deepforgeIlvl(-4)).toBe(1 + DEEPFORGE_ILVL.min);
    expect(deepforgeIlvl(undefined)).toBe(1 + DEEPFORGE_ILVL.min);
    expect(Number.isFinite(deepforgeIlvl(NaN))).toBe(true);
  });
});

describe('storiedStatCount', () => {
  it('is the rarity cap plus the extra property', () => {
    expect(storiedStatCount(2)).toBe(2 + STORIED_EXTRA_STATS); // uncommon
    expect(storiedStatCount(5)).toBe(5 + STORIED_EXTRA_STATS); // legendary — past the 5-stat ceiling
  });

  it('lifts every rarity above what its colour alone can hold', () => {
    for (const cap of [0, 1, 2, 3, 4, 5]) expect(storiedStatCount(cap)).toBeGreaterThan(cap);
  });

  it('is safe on a missing or negative cap', () => {
    expect(storiedStatCount(undefined)).toBe(STORIED_EXTRA_STATS);
    expect(storiedStatCount(-3)).toBe(STORIED_EXTRA_STATS);
  });
});
