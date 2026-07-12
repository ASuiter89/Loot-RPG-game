import { describe, it, expect } from 'vitest';
import {
  enchTierFactor,
  augmentSlotFactor,
  enchEscalation,
  eligibleMaterials,
  materialPalette,
  augmentCost,
  rerollAllCost,
  rerollTypeCost,
  rerollValueCost,
} from '../../src/systems/enchantCost.js';
import { ENCH_COST } from '../../src/data/enchantTuning.js';

// Rarity ranks used across the suite (index into TIERS): 1 normal … 6 unique.
const NORMAL = 1, UNCOMMON = 2, RARE = 3, EPIC = 4, LEGENDARY = 5, UNIQUE = 6;
const MAT_KEYS = ['scrap', 'glimmer', 'core', 'chaos'];
// Total material units in a cost (across every crafting material it charges).
const matTotal = c => MAT_KEYS.reduce((s, k) => s + (c[k] || 0), 0);
const matKeys = c => MAT_KEYS.filter(k => c[k]);

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

describe('enchEscalation', () => {
  it('is 1 before any reroll, then compounds by escalationStep each reroll', () => {
    expect(enchEscalation(0)).toBe(1);
    expect(enchEscalation(1)).toBeCloseTo(ENCH_COST.escalationStep);
    expect(enchEscalation(4)).toBeCloseTo(ENCH_COST.escalationStep ** 4);
  });

  it('is strictly increasing with the reroll tally (so brute-forcing gets dearer)', () => {
    for (let t = 1; t <= 30; t++) expect(enchEscalation(t)).toBeGreaterThan(enchEscalation(t - 1));
  });

  it('clamps a negative/fractional tally to a whole, non-negative power', () => {
    expect(enchEscalation(-3)).toBe(1);
    expect(enchEscalation(2.9)).toBeCloseTo(ENCH_COST.escalationStep ** 2);
  });
});

describe('eligibleMaterials', () => {
  it('gates each material behind a rarity rank (rarer gear unlocks rarer materials)', () => {
    expect(eligibleMaterials(0)).toEqual(['scrap']);                          // junk: Scrap only
    expect(eligibleMaterials(NORMAL)).toEqual(['scrap', 'glimmer']);
    expect(eligibleMaterials(UNCOMMON)).toEqual(['scrap', 'glimmer']);        // still no Core
    expect(eligibleMaterials(RARE)).toEqual(['scrap', 'glimmer', 'core']);    // Core unlocks
    expect(eligibleMaterials(EPIC)).toEqual(['scrap', 'glimmer', 'core']);    // Chaos still gated
    expect(eligibleMaterials(LEGENDARY)).toEqual(['scrap', 'glimmer', 'core', 'chaos']);
  });
});

describe('materialPalette', () => {
  it('is deterministic — the same (rank, seed) always yields the same mix', () => {
    for (const seed of [0, 1, 0.42, 'abc', 99999]) {
      expect(materialPalette(RARE, seed)).toEqual(materialPalette(RARE, seed));
    }
  });

  it('only ever draws materials eligible at that rank, with no duplicates', () => {
    for (let rank = 0; rank <= LEGENDARY; rank++) {
      const elig = eligibleMaterials(rank);
      for (let seed = 0; seed < 60; seed++) {
        const pal = materialPalette(rank, seed);
        expect(pal.length).toBeGreaterThanOrEqual(1);
        expect(new Set(pal).size).toBe(pal.length);           // no dupes
        for (const m of pal) expect(elig).toContain(m);
      }
    }
  });

  it('never asks a low-rarity piece for a material rarer than itself', () => {
    for (let seed = 0; seed < 80; seed++) {
      // Core only from rare, Chaos only from legendary.
      for (const rank of [0, NORMAL, UNCOMMON]) expect(materialPalette(rank, seed)).not.toContain('core');
      for (const rank of [0, NORMAL, UNCOMMON, RARE, EPIC]) expect(materialPalette(rank, seed)).not.toContain('chaos');
    }
  });

  it('a junk piece can only ever cost Scrap', () => {
    for (let seed = 0; seed < 40; seed++) expect(materialPalette(0, seed)).toEqual(['scrap']);
  });

  it('actually varies the mix across pieces (not always the same boring set)', () => {
    const seen = new Set();
    for (let seed = 0; seed < 120; seed++) seen.add(materialPalette(LEGENDARY, seed).slice().sort().join('+'));
    expect(seen.size).toBeGreaterThan(3);   // many distinct palettes, not one fixed bill
  });
});

describe('cost objects — shared shape', () => {
  const FNS = { augment: augmentCost, rerollAll: rerollAllCost, rerollType: rerollTypeCost, rerollValue: rerollValueCost };

  it('every action always charges gold and at least one material', () => {
    for (const [name, fn] of Object.entries(FNS)) {
      for (const rank of [NORMAL, RARE, EPIC, LEGENDARY]) {
        for (const seed of [1, 2, 7, 42]) {
          const c = fn({ rank, ilvl: 12, seed });
          expect(c.gold, `${name} gold`).toBeGreaterThan(0);
          expect(matTotal(c), `${name} materials`).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('only ever charges materials eligible at the piece rarity', () => {
    for (const fn of Object.values(FNS)) {
      for (let rank = NORMAL; rank <= LEGENDARY; rank++) {
        const elig = eligibleMaterials(rank);
        for (let seed = 0; seed < 40; seed++) {
          for (const k of matKeys(fn({ rank, ilvl: 20, seed }))) expect(elig).toContain(k);
        }
      }
    }
  });

  it('never charges Core below rare, nor a Chaos Orb below legendary', () => {
    for (const fn of Object.values(FNS)) {
      for (let seed = 0; seed < 40; seed++) {
        for (const rank of [NORMAL, UNCOMMON]) expect(fn({ rank, ilvl: 20, seed }).core).toBeUndefined();
        for (const rank of [NORMAL, UNCOMMON, RARE, EPIC]) expect(fn({ rank, ilvl: 20, seed }).chaos).toBeUndefined();
      }
    }
  });

  it('is fully deterministic — same inputs give an identical cost', () => {
    const args = { rank: EPIC, ilvl: 18, affixes: 2, tally: 3, seed: 0.7734 };
    expect(augmentCost(args)).toEqual(augmentCost(args));
    expect(rerollValueCost(args)).toEqual(rerollValueCost(args));
  });

  it('shares one material PALETTE across all four actions on a given piece', () => {
    // Same seed → same mix of materials for augment / reroll-all / type / value.
    for (const seed of [3, 8, 21, 55]) {
      const keys = fn => matKeys(fn({ rank: LEGENDARY, ilvl: 20, seed })).sort().join('+');
      const pal = materialPalette(LEGENDARY, seed).slice().sort().join('+');
      // Cheaper actions may round a rare material away, so each action's keys are a
      // SUBSET of the palette — but they never introduce a material outside it.
      for (const fn of [augmentCost, rerollAllCost, rerollTypeCost, rerollValueCost]) {
        for (const k of keys(fn).split('+').filter(Boolean)) expect(pal.split('+')).toContain(k);
      }
    }
  });
});

describe('escalation on cost', () => {
  it('raises every reroll tally → strictly more gold on the same piece', () => {
    let prev = 0;
    for (let tally = 0; tally <= 10; tally++) {
      const g = rerollValueCost({ rank: EPIC, ilvl: 20, seed: 5, tally }).gold;
      expect(g).toBeGreaterThan(prev);
      prev = g;
    }
  });

  it('raises the material bill too — a well-rerolled piece costs far more materials', () => {
    const fresh = rerollTypeCost({ rank: EPIC, ilvl: 20, seed: 5, tally: 0 });
    const worn  = rerollTypeCost({ rank: EPIC, ilvl: 20, seed: 5, tally: 12 });
    expect(matTotal(worn)).toBeGreaterThan(matTotal(fresh));
    // ~1.15^12 ≈ 5.35x, so it should be several times the fresh bill.
    expect(worn.gold).toBeGreaterThan(fresh.gold * 4);
  });

  it('leaves the material PALETTE unchanged as costs escalate (only amounts move)', () => {
    const keysAt = tally => matKeys(rerollAllCost({ rank: LEGENDARY, ilvl: 20, seed: 9, tally })).sort().join('+');
    expect(keysAt(20)).toBe(keysAt(0));
  });
});

describe('augmentCost — per-slot climb', () => {
  it('costs strictly more gold for each property already on the piece', () => {
    let prev = 0;
    for (let a = 0; a <= 5; a++) {
      const g = augmentCost({ rank: LEGENDARY, ilvl: 15, affixes: a, seed: 4 }).gold;
      expect(g).toBeGreaterThan(prev);
      prev = g;
    }
  });

  it('makes the last slot dramatically pricier than the first', () => {
    const first = augmentCost({ rank: LEGENDARY, ilvl: 15, affixes: 0, seed: 4 });
    const last = augmentCost({ rank: LEGENDARY, ilvl: 15, affixes: 5, seed: 4 });
    expect(last.gold / first.gold).toBeGreaterThan(5);        // slotGrowth**5 ≈ 10x
    expect(matTotal(last)).toBeGreaterThan(matTotal(first));
  });

  it('the first-slot, no-reroll gold keeps the historical (base+ilvl*perIlvl)*tierFactor curve', () => {
    const g = ENCH_COST.gold.augment;
    const ilvl = 12, rank = RARE;
    const expected = Math.round((g.base + ilvl * g.perIlvl) * enchTierFactor(rank));
    expect(augmentCost({ rank, ilvl, affixes: 0, tally: 0, seed: 1 }).gold).toBe(expected);
  });

  it('scales gold and materials up with rarity and item level', () => {
    const lo = augmentCost({ rank: NORMAL, ilvl: 3, affixes: 0, seed: 2 });
    const hi = augmentCost({ rank: EPIC, ilvl: 25, affixes: 0, seed: 2 });
    expect(hi.gold).toBeGreaterThan(lo.gold);
    expect(matTotal(hi)).toBeGreaterThan(matTotal(lo));
  });

  it('defaults ilvl to 1, affixes to 0, tally to 0 and seed to 0 when omitted', () => {
    expect(augmentCost({ rank: NORMAL })).toEqual(augmentCost({ rank: NORMAL, ilvl: 1, affixes: 0, tally: 0, seed: 0 }));
  });
});

describe('action ordering (cheap nibble → full reforge)', () => {
  it('value ≤ type ≤ reroll-all in both gold and total materials on the same piece', () => {
    for (const seed of [1, 6, 13, 44]) {
      const base = { rank: EPIC, ilvl: 20, seed };
      const v = rerollValueCost(base), t = rerollTypeCost(base), a = rerollAllCost(base);
      expect(v.gold).toBeLessThan(t.gold);
      expect(t.gold).toBeLessThan(a.gold);
      // Shared palette + shared split, so units scale monotonically with the weight.
      expect(matTotal(v)).toBeLessThanOrEqual(matTotal(t));
      expect(matTotal(t)).toBeLessThanOrEqual(matTotal(a));
    }
  });

  it('a full reforge costs more than a single augment of the same piece', () => {
    const seed = 17;
    const all = rerollAllCost({ rank: EPIC, ilvl: 15, seed });
    const oneAug = augmentCost({ rank: EPIC, ilvl: 15, affixes: 0, seed });
    expect(all.gold).toBeGreaterThan(oneAug.gold);
  });
});
