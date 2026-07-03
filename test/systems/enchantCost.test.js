import { describe, it, expect } from 'vitest';
import {
  enchTierFactor,
  augmentSlotFactor,
  augmentCost,
  rerollAllCost,
  rerollTypeCost,
  rerollValueCost,
} from '../../src/systems/enchantCost.js';
import { ENCH_COST } from '../../src/data/enchantTuning.js';

// Rarity ranks used across the suite (index into TIERS): 1 normal … 6 unique.
const NORMAL = 1, UNCOMMON = 2, RARE = 3, EPIC = 4, LEGENDARY = 5, UNIQUE = 6;

describe('enchTierFactor', () => {
  it('starts at 1 for a junk-rank item and climbs a step per rarity', () => {
    expect(enchTierFactor(0)).toBe(1);
    expect(enchTierFactor(1)).toBeCloseTo(1 + ENCH_COST.tierFactorStep);
    expect(enchTierFactor(RARE)).toBeCloseTo(1 + RARE * ENCH_COST.tierFactorStep);
  });

  it('is strictly increasing with rank', () => {
    for (let r = 1; r <= UNIQUE; r++) expect(enchTierFactor(r)).toBeGreaterThan(enchTierFactor(r - 1));
  });
});

describe('augmentSlotFactor', () => {
  it('is 1 for the first (0 affixes) slot', () => {
    expect(augmentSlotFactor(0)).toBe(1);
  });

  it('grows geometrically by slotGrowth per affix already present', () => {
    expect(augmentSlotFactor(1)).toBeCloseTo(ENCH_COST.slotGrowth);
    expect(augmentSlotFactor(3)).toBeCloseTo(ENCH_COST.slotGrowth ** 3);
  });

  it('clamps a negative or fractional affix count to a whole, non-negative power', () => {
    expect(augmentSlotFactor(-2)).toBe(1);   // never cheaper than the first slot
    expect(augmentSlotFactor(2.9)).toBeCloseTo(ENCH_COST.slotGrowth ** 2); // truncated to 2
  });
});

describe('augmentCost', () => {
  it('always charges gold, Glimmer and Scrap', () => {
    const c = augmentCost({ rank: NORMAL, ilvl: 5, affixes: 0 });
    expect(c.gold).toBeGreaterThan(0);
    expect(c.glimmer).toBeGreaterThan(0);
    expect(c.scrap).toBeGreaterThanOrEqual(1);
  });

  it('does not charge Core below rare rank, but does at rare and up', () => {
    expect(augmentCost({ rank: UNCOMMON, ilvl: 10, affixes: 0 }).core).toBeUndefined();
    expect(augmentCost({ rank: RARE, ilvl: 10, affixes: 0 }).core).toBeGreaterThanOrEqual(1);
  });

  it('never charges a Chaos Orb (that is reserved for the big reforge)', () => {
    expect(augmentCost({ rank: LEGENDARY, ilvl: 20, affixes: 4 }).chaos).toBeUndefined();
  });

  it('costs strictly more gold and Scrap for each property already on the piece', () => {
    const at = a => augmentCost({ rank: LEGENDARY, ilvl: 15, affixes: a });
    let prevGold = 0, prevScrap = 0;
    for (let a = 0; a <= 5; a++) {
      const c = at(a);
      expect(c.gold).toBeGreaterThan(prevGold);
      expect(c.scrap).toBeGreaterThan(prevScrap);
      prevGold = c.gold; prevScrap = c.scrap;
    }
  });

  it('makes the last slot dramatically pricier than the first', () => {
    const first = augmentCost({ rank: LEGENDARY, ilvl: 15, affixes: 0 });
    const last = augmentCost({ rank: LEGENDARY, ilvl: 15, affixes: 5 });
    // slotGrowth**5 ≈ 10x — the last slot really should sting.
    expect(last.gold / first.gold).toBeGreaterThan(5);
    expect(last.scrap / first.scrap).toBeGreaterThan(5);
  });

  it('does NOT inflate Glimmer with the slot count (Glimmer scales by rarity only)', () => {
    const first = augmentCost({ rank: LEGENDARY, ilvl: 15, affixes: 0 });
    const last = augmentCost({ rank: LEGENDARY, ilvl: 15, affixes: 5 });
    expect(last.glimmer).toBe(first.glimmer);
  });

  it('the first slot leaves the historical gold formula (base+ilvl*perIlvl)*tierFactor intact', () => {
    const g = ENCH_COST.gold.augment;
    const ilvl = 12, rank = RARE;
    const expected = Math.round((g.base + ilvl * g.perIlvl) * enchTierFactor(rank));
    expect(augmentCost({ rank, ilvl, affixes: 0 }).gold).toBe(expected);
  });

  it('scales gold and Scrap up with rarity and item level', () => {
    const lo = augmentCost({ rank: NORMAL, ilvl: 3, affixes: 0 });
    const hi = augmentCost({ rank: EPIC, ilvl: 25, affixes: 0 });
    expect(hi.gold).toBeGreaterThan(lo.gold);
    expect(hi.scrap).toBeGreaterThan(lo.scrap);
  });

  it('defaults ilvl to 1 and affixes to 0 when omitted', () => {
    const c = augmentCost({ rank: NORMAL });
    expect(c).toEqual(augmentCost({ rank: NORMAL, ilvl: 1, affixes: 0 }));
  });
});

describe('rerollAllCost', () => {
  it('charges gold, Glimmer and Scrap, and Core at rare+', () => {
    const c = rerollAllCost({ rank: RARE, ilvl: 10 });
    expect(c.gold).toBeGreaterThan(0);
    expect(c.glimmer).toBeGreaterThan(0);
    expect(c.scrap).toBeGreaterThanOrEqual(1);
    expect(c.core).toBeGreaterThanOrEqual(1);
  });

  it('burns exactly one Chaos Orb only at epic rank and above', () => {
    expect(rerollAllCost({ rank: RARE, ilvl: 10 }).chaos).toBeUndefined();
    expect(rerollAllCost({ rank: EPIC, ilvl: 10 }).chaos).toBe(1);
    expect(rerollAllCost({ rank: UNIQUE, ilvl: 30 }).chaos).toBe(1);
  });

  it('costs more than a single augment of the same piece (it reforges everything)', () => {
    const all = rerollAllCost({ rank: EPIC, ilvl: 15 });
    const oneAug = augmentCost({ rank: EPIC, ilvl: 15, affixes: 0 });
    expect(all.scrap).toBeGreaterThan(oneAug.scrap);
  });
});

describe('rerollTypeCost / rerollValueCost', () => {
  it('both always charge gold, Glimmer and Scrap', () => {
    for (const fn of [rerollTypeCost, rerollValueCost]) {
      const c = fn({ rank: NORMAL, ilvl: 5 });
      expect(c.gold).toBeGreaterThan(0);
      expect(c.glimmer).toBeGreaterThan(0);
      expect(c.scrap).toBeGreaterThanOrEqual(1);
    }
  });

  it('value reroll (the cheap nibble) costs no Core on a just-rare, low-level piece…', () => {
    // With the small value-reroll weight, Core rounds below 1 and is omitted.
    expect(rerollValueCost({ rank: RARE, ilvl: 5 }).core).toBeUndefined();
  });

  it('…but rerolling DOES spend Cores on higher rarity / deeper gear', () => {
    expect(rerollValueCost({ rank: EPIC, ilvl: 15 }).core).toBeGreaterThanOrEqual(1);
    expect(rerollTypeCost({ rank: RARE, ilvl: 15 }).core).toBeGreaterThanOrEqual(1);
  });

  it('a value reroll is cheaper than a type reroll, which is cheaper than a full reforge', () => {
    const v = rerollValueCost({ rank: EPIC, ilvl: 20 });
    const t = rerollTypeCost({ rank: EPIC, ilvl: 20 });
    const a = rerollAllCost({ rank: EPIC, ilvl: 20 });
    expect(v.gold).toBeLessThan(t.gold);
    expect(t.gold).toBeLessThan(a.gold);
    expect(v.scrap).toBeLessThanOrEqual(t.scrap);
    expect(t.scrap).toBeLessThan(a.scrap);
  });

  it('value reroll Glimmer is flat (div 0 → no rarity term)', () => {
    expect(rerollValueCost({ rank: NORMAL, ilvl: 1 }).glimmer)
      .toBe(rerollValueCost({ rank: UNIQUE, ilvl: 1 }).glimmer);
  });

  it('type reroll Glimmer picks up a gentle per-rarity bump', () => {
    expect(rerollTypeCost({ rank: UNIQUE, ilvl: 1 }).glimmer)
      .toBeGreaterThan(rerollTypeCost({ rank: NORMAL, ilvl: 1 }).glimmer);
  });
});
