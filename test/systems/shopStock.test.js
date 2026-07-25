import { describe, it, expect } from 'vitest';
import { shopTierWeights } from '../../src/systems/shopStock.js';
import {
  SHOP_TIER_BANDS, SHOP_TIER_FLOOR, SHOP_FALLBACK_TIER,
} from '../../src/data/shopStock.js';

// The tier that would be offered most often for a given weight map.
function modalTier(weights) {
  return Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
}

// A deep hero with everything unlocked (empty ledger + high maxFloor implies every
// boss cleared — see rarityGate.bossDefeated), so only the ilvl bell shapes it.
const OPEN = [{}, 999];

describe('shopTierWeights — never junk, never empty', () => {
  it('never offers grey junk at any depth', () => {
    for (const ilvl of [1, 3, 6, 11, 20, 40, 80, 120]) {
      expect(shopTierWeights(ilvl, ...OPEN).junk).toBeUndefined();
    }
  });

  it('always returns at least one sellable tier', () => {
    for (const ilvl of [1, 5, 10, 50, 200]) {
      expect(Object.keys(shopTierWeights(ilvl, ...OPEN)).length).toBeGreaterThan(0);
    }
  });

  it('falls back to the floor tier if a garbage ilvl leaves nothing', () => {
    // Defensive: NaN/0/negative ilvl is clamped to 1, which always yields 'normal'.
    for (const bad of [NaN, 0, -5, undefined]) {
      const w = shopTierWeights(bad, ...OPEN);
      expect(Object.keys(w).length).toBeGreaterThan(0);
      expect(w[SHOP_FALLBACK_TIER]).toBeGreaterThan(0);
    }
  });
});

describe('shopTierWeights — rarity scales with item level', () => {
  it('peaks each tier around its own center ilvl', () => {
    // At exactly a band's center its bell weight is 1.0 (the max any tier can
    // reach), so it must be the most-offered tier there.
    for (const band of SHOP_TIER_BANDS) {
      expect(modalTier(shopTierWeights(band.center, ...OPEN))).toBe(band.tier);
    }
  });

  it('shifts the headline colour rarer as the shop gets deeper', () => {
    const order = SHOP_TIER_BANDS.map(b => b.tier);
    const idx = t => order.indexOf(t);
    let prev = -1;
    for (const ilvl of [4, 16, 30, 50, 78]) {
      const cur = idx(modalTier(shopTierWeights(ilvl, ...OPEN)));
      expect(cur).toBeGreaterThanOrEqual(prev); // monotone non-decreasing in rarity
      prev = cur;
    }
  });

  it('trims a vanishing out-of-band tail (no red on a just-blue-unlocked stall)', () => {
    // Floor-10 stall (blue just unlocked): unique's bell share is far below the
    // floor, so it must not appear, while rare — in band — does.
    const w = shopTierWeights(11, {}, 999);
    expect(w.unique).toBeUndefined();
    expect(w.rare).toBeGreaterThan(0);
    // Every surviving tier clears the minimum share.
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    for (const v of Object.values(w)) expect(v / total).toBeGreaterThanOrEqual(SHOP_TIER_FLOOR);
  });
});

describe('shopTierWeights — honours the early-game rarity gate', () => {
  it('before any boss, a stall sells only white — no colour at all', () => {
    // Fresh hero on floor 3: greens gated to the floor-5 boss, blues+ to floor-10.
    for (const ilvl of [2, 4, 5]) {
      const w = shopTierWeights(ilvl, {}, 3);
      expect(Object.keys(w)).toEqual(['normal']);
    }
  });

  it('after the floor-5 boss, greens sell but blue+ still cannot', () => {
    const w = shopTierWeights(8, { '5': 1 }, 9); // green unlocked, blue still gated
    expect(w.uncommon).toBeGreaterThan(0);
    for (const locked of ['rare', 'epic', 'legendary', 'unique']) {
      expect(w[locked]).toBeUndefined();
    }
  });

  it('the gate outranks depth: an ilvl in a locked tier\'s band still omits it', () => {
    // Item level 16 is exactly where blue (rare) would peak, but only the floor-5
    // boss is down — so rare+ stay withheld and the table falls back on green.
    const w = shopTierWeights(16, { '5': 1 }, 9);
    for (const locked of ['rare', 'epic', 'legendary', 'unique']) {
      expect(w[locked]).toBeUndefined();
    }
    expect(w.uncommon).toBeGreaterThan(0);
  });

  it('opens the full ladder once the floor-10 boss falls', () => {
    // Deep hero, both early bosses cleared: the rarer colours are reachable.
    const w = shopTierWeights(60, { '5': 1, '10': 1 }, 60);
    expect(w.legendary).toBeGreaterThan(0);
    expect(w.unique).toBeGreaterThan(0);
  });
});

describe('shopTierWeights — caps at the highest rarity the hero has FOUND', () => {
  // Deep, everything boss-unlocked, so ONLY the found cap can shape the ladder.
  const DEEP = [{ '5': 1, '10': 1 }, 999];

  it('a fourth arg omitted keeps the old (uncapped) behaviour', () => {
    const w = shopTierWeights(60, ...DEEP);
    expect(w.legendary).toBeGreaterThan(0);
    expect(w.unique).toBeGreaterThan(0);
  });

  it('never found a blue → the merchant never stocks blue+ even when boss-unlocked', () => {
    // Highest found is green (rank 2): blue/purple/orange/red are withheld.
    const w = shopTierWeights(60, ...DEEP, 2);
    for (const t of ['rare', 'epic', 'legendary', 'unique']) expect(w[t]).toBeUndefined();
  });

  it('found a purple → purple sells, orange/red still withheld', () => {
    const w = shopTierWeights(60, ...DEEP, 4); // epic (purple) is the highest found
    expect(w.epic).toBeGreaterThan(0);
    for (const t of ['legendary', 'unique']) expect(w[t]).toBeUndefined();
  });

  it('found a red → the full ladder is available again', () => {
    const w = shopTierWeights(60, ...DEEP, 6);
    expect(w.legendary).toBeGreaterThan(0);
    expect(w.unique).toBeGreaterThan(0);
  });

  it('a white-only hero still gets a sellable stall (falls back to normal)', () => {
    const w = shopTierWeights(60, ...DEEP, 1); // only white found
    expect(Object.keys(w).length).toBeGreaterThan(0);
    expect(w[SHOP_FALLBACK_TIER]).toBeGreaterThan(0);
    for (const t of ['uncommon', 'rare', 'epic', 'legendary', 'unique']) expect(w[t]).toBeUndefined();
  });

  it('the found cap and the boss gate compose — the stricter of the two wins', () => {
    // Found a purple (rank 4) but only the floor-5 boss is down (blue+ still boss-gated):
    // the boss gate is stricter here, so blue+ stay withheld despite the higher find.
    const w = shopTierWeights(16, { '5': 1 }, 9, 4);
    expect(w.uncommon).toBeGreaterThan(0);
    for (const t of ['rare', 'epic', 'legendary', 'unique']) expect(w[t]).toBeUndefined();
  });
});
