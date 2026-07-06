import { describe, it, expect } from 'vitest';
import { COVENANTS, DREAD_TUNING } from '../../src/data/covenants.js';
import { DREAD_REWARDS } from '../../src/data/dreadRewards.js';
import {
  softcap,
  activeDread,
  covenantById,
  sortedCovenants,
  covenantMultipliers,
  dreadRewardMult,
  isUnlocked,
  sanitizeActiveSet,
  projectedSummary,
} from '../../src/systems/covenants.js';

// A tiny synthetic catalog to exercise aggregation in isolation of live tuning.
const FAKE = [
  { id: 'a', unlockOrder: 0, name: 'Alpha', dread: 2, category: 'offense',
    params: { enemyDmgMult: 1.5, dropQtyMult: 1.1 } },
  { id: 'b', unlockOrder: 1, name: 'Beta', dread: 3, category: 'defense',
    params: { enemyHpMult: 2, healingMult: 0.5 } },
  { id: 'c', unlockOrder: 2, name: 'Gamma', dread: 1, category: 'defense',
    params: { healingMult: 0.8, eliteChanceAdd: 0.2, malaiseRate: 0.03 } },
];

describe('softcap', () => {
  it('is 0 at x=0, and 0 for non-positive x or cap', () => {
    expect(softcap(0, 1)).toBe(0);
    expect(softcap(-5, 1)).toBe(0);
    expect(softcap(5, 0)).toBe(0);
    expect(softcap(5, -1)).toBe(0);
  });

  it('is strictly increasing in x', () => {
    let prev = -1;
    for (let x = 0; x <= 20; x += 0.5) {
      const v = softcap(x, 2);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('is bounded above by cap and approaches it', () => {
    // Never exceeds the cap; at extreme x the exponential underflows to exactly cap.
    expect(softcap(1e6, 2)).toBeLessThanOrEqual(2);
    expect(softcap(1e6, 2)).toBeCloseTo(2, 3);
    // At moderate x it is genuinely strictly below the cap.
    expect(softcap(20, 1.5)).toBeLessThan(1.5);
    for (let x = 0; x <= 100; x++) expect(softcap(x, 1.5)).toBeLessThanOrEqual(1.5);
  });

  it('handles NaN/garbage as a no-op', () => {
    expect(softcap(NaN, 2)).toBe(0);
    expect(softcap(5, NaN)).toBe(0);
  });
});

describe('activeDread', () => {
  it('sums the dread of the active covenants', () => {
    expect(activeDread(['a', 'b'], FAKE)).toBe(5);
  });
  it('dedups and ignores unknown ids', () => {
    expect(activeDread(['a', 'a', 'zzz'], FAKE)).toBe(2);
  });
  it('is 0 for empty / garbage input', () => {
    expect(activeDread([], FAKE)).toBe(0);
    expect(activeDread(null, FAKE)).toBe(0);
    expect(activeDread(undefined, FAKE)).toBe(0);
    expect(activeDread(42, FAKE)).toBe(0);
  });
  it('works against the real catalog by default', () => {
    const total = COVENANTS.reduce((s, c) => s + c.dread, 0);
    expect(activeDread(COVENANTS.map((c) => c.id))).toBe(total);
  });
});

describe('covenantById', () => {
  it('finds a def or returns null', () => {
    expect(covenantById('b', FAKE).name).toBe('Beta');
    expect(covenantById('nope', FAKE)).toBeNull();
    expect(covenantById(null, FAKE)).toBeNull();
  });
  it('defaults to the real catalog', () => {
    expect(covenantById('cov_frenzy').category).toBe('offense');
  });
});

describe('sortedCovenants', () => {
  it('sorts by unlockOrder then dread then name without mutating input', () => {
    const shuffled = [FAKE[2], FAKE[0], FAKE[1]];
    const copy = shuffled.slice();
    const out = sortedCovenants(shuffled);
    expect(out.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(shuffled).toEqual(copy); // untouched
  });
  it('handles garbage as the real catalog', () => {
    expect(sortedCovenants(null).length).toBe(COVENANTS.length);
  });
});

describe('covenantMultipliers', () => {
  it('is fully neutral for an empty set', () => {
    expect(covenantMultipliers([], FAKE)).toEqual(DREAD_TUNING.neutralParams);
  });

  it('multiplies the multiplicative knobs, MINs healing, SUMs the rates', () => {
    const m = covenantMultipliers(['a', 'b', 'c'], FAKE);
    expect(m.enemyDmgMult).toBeCloseTo(1.5, 10);   // only a
    expect(m.enemyHpMult).toBeCloseTo(2, 10);       // only b
    expect(m.dropQtyMult).toBeCloseTo(1.1, 10);     // only a
    expect(m.healingMult).toBeCloseTo(0.5, 10);     // MIN of 0.5 and 0.8, not the product
    expect(m.eliteChanceAdd).toBeCloseTo(0.2, 10);  // sum (only c)
    expect(m.malaiseRate).toBeCloseTo(0.03, 10);    // sum (only c)
  });

  it('multiplies knobs that appear in more than one active covenant', () => {
    const data = [
      { id: 'x', dread: 1, params: { enemyHpMult: 1.2 } },
      { id: 'y', dread: 1, params: { enemyHpMult: 1.5 } },
    ];
    expect(covenantMultipliers(['x', 'y'], data).enemyHpMult).toBeCloseTo(1.8, 10);
  });

  it('clamps summed elite chance to maxEliteChance', () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      id: 'e' + i, dread: 1, params: { eliteChanceAdd: 0.2 },
    }));
    const m = covenantMultipliers(data.map((d) => d.id), data);
    expect(m.eliteChanceAdd).toBe(DREAD_TUNING.maxEliteChance);
  });

  it('tolerates a covenant with garbage / missing params', () => {
    const data = [
      { id: 'g', dread: 1, params: { enemyHpMult: NaN, healingMult: 5 } },
      { id: 'h', dread: 1 }, // no params at all
    ];
    const m = covenantMultipliers(['g', 'h'], data);
    expect(m.enemyHpMult).toBe(1);   // NaN → neutral, clamped >=1
    expect(m.healingMult).toBe(1);   // 5 clamped into (0,1]
  });
});

describe('dreadRewardMult', () => {
  it('is all ×1 at zero / negative / NaN dread', () => {
    for (const d of [0, -3, NaN]) {
      const r = dreadRewardMult(d);
      expect(r.lootQty).toBe(1);
      expect(r.rarity).toBe(1);
      expect(r.bossPoint).toBe(1);
      expect(r.material).toBe(1);
    }
  });

  it('rises with dread but never past 1 + cap for every curve', () => {
    // Extreme dread: bounded by the cap (float underflow may land exactly on it).
    const r = dreadRewardMult(1000);
    expect(r.lootQty).toBeLessThanOrEqual(1 + DREAD_REWARDS.lootQty.cap);
    expect(r.rarity).toBeLessThanOrEqual(1 + DREAD_REWARDS.rarity.cap);
    expect(r.bossPoint).toBeLessThanOrEqual(1 + DREAD_REWARDS.bossPoint.cap);
    expect(r.material).toBeLessThanOrEqual(1 + DREAD_REWARDS.material.cap);
    // A realistic deep run (Dread ~30) is strictly under every ceiling and above 1.
    const mid = dreadRewardMult(30);
    for (const k of ['lootQty', 'rarity', 'bossPoint', 'material']) {
      expect(mid[k]).toBeGreaterThan(1);
      expect(mid[k]).toBeLessThan(1 + DREAD_REWARDS[k].cap);
    }
  });

  it('is monotonic non-decreasing in dread', () => {
    let prev = { lootQty: 0, rarity: 0, bossPoint: 0, material: 0 };
    for (let d = 0; d <= 40; d++) {
      const r = dreadRewardMult(d);
      expect(r.lootQty).toBeGreaterThanOrEqual(prev.lootQty);
      expect(r.material).toBeGreaterThanOrEqual(prev.material);
      prev = r;
    }
  });

  it('honours a custom rewards object', () => {
    const r = dreadRewardMult(10, { lootQty: { perDread: 1, cap: 1 }, rarity: {}, bossPoint: {}, material: {} });
    expect(r.lootQty).toBeGreaterThan(1);
    expect(r.lootQty).toBeLessThan(2);
    expect(r.rarity).toBe(1); // empty curve → no bonus
  });
});

describe('isUnlocked', () => {
  it('unlocks once marks reach the covenant unlockOrder', () => {
    expect(isUnlocked('a', 0, FAKE)).toBe(true);   // unlockOrder 0
    expect(isUnlocked('b', 0, FAKE)).toBe(false);  // needs 1
    expect(isUnlocked('b', 1, FAKE)).toBe(true);
    expect(isUnlocked('c', 5, FAKE)).toBe(true);
  });
  it('is false for an unknown id and tolerates garbage marks', () => {
    expect(isUnlocked('nope', 99, FAKE)).toBe(false);
    expect(isUnlocked('a', NaN, FAKE)).toBe(true);   // unlockOrder 0
    expect(isUnlocked('b', -5, FAKE)).toBe(false);
    expect(isUnlocked('b', 1.9, FAKE)).toBe(true);   // floors to 1
  });
});

describe('sanitizeActiveSet', () => {
  it('keeps known ids in order, dropping unknowns and dupes', () => {
    expect(sanitizeActiveSet(['b', 'zzz', 'a', 'a'], FAKE)).toEqual(['b', 'a']);
  });
  it('returns [] for garbage / old saves', () => {
    expect(sanitizeActiveSet(null, FAKE)).toEqual([]);
    expect(sanitizeActiveSet('cov_frenzy', FAKE)).toEqual([]);
    expect(sanitizeActiveSet(undefined, FAKE)).toEqual([]);
  });
  it('validates against the real catalog by default', () => {
    expect(sanitizeActiveSet(['cov_frenzy', 'bogus'])).toEqual(['cov_frenzy']);
  });
});

describe('projectedSummary', () => {
  it('bundles dread, multipliers and reward multipliers for the altar preview', () => {
    const s = projectedSummary(['a', 'b'], FAKE, DREAD_REWARDS);
    expect(s.dread).toBe(5);
    expect(s.multipliers.enemyHpMult).toBeCloseTo(2, 10);
    expect(s.rewards.lootQty).toBe(dreadRewardMult(5, DREAD_REWARDS).lootQty);
  });
  it('is neutral for an empty set', () => {
    const s = projectedSummary([], FAKE);
    expect(s.dread).toBe(0);
    expect(s.multipliers).toEqual(DREAD_TUNING.neutralParams);
    expect(s.rewards.material).toBe(1);
  });
});
