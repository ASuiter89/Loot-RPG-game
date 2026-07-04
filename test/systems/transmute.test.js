import { describe, it, expect } from 'vitest';
import {
  fuseCount,
  isFusable,
  transmuteCost,
  fusableByTier,
  resolveTransmute,
} from '../../src/systems/transmute.js';
import { TRANSMUTE_COUNTS } from '../../src/data/transmuteRecipe.js';

// The rarity ladder matching the shape of TIERS keys (junk → … → unique).
const TIER_ORDER = ['junk', 'normal', 'uncommon', 'rare', 'epic', 'legendary', 'unique'];

// Tiny gear factory: real gear carries an equip `slot`; give each a stable id.
let _id = 1;
function gear(tier, { locked = false, value = 10, slot = 'ring' } = {}) {
  return { id: _id++, tier, slot, locked, value };
}
// A non-gear stack (potion / material) — no slot, never fusable.
function junkStack(tier = 'junk') { return { id: _id++, tier, value: 1 }; }
// Make `n` unlocked gear pieces of a tier.
function many(tier, n) { return Array.from({ length: n }, () => gear(tier)); }

describe('fuseCount', () => {
  it('escalates up the ladder per the recipe data', () => {
    expect(fuseCount('junk')).toBe(2);
    expect(fuseCount('normal')).toBe(2);
    expect(fuseCount('uncommon')).toBe(3);
    expect(fuseCount('rare')).toBe(3);
    expect(fuseCount('epic')).toBe(4);
    expect(fuseCount('legendary')).toBe(5);
  });
  it('returns 0 for the top rarity (unique) and unknown tiers — they can\'t be fused', () => {
    expect(fuseCount('unique')).toBe(0);
    expect(fuseCount('mythic')).toBe(0);
    expect(fuseCount(undefined)).toBe(0);
  });
  it('mirrors the TRANSMUTE_COUNTS table exactly', () => {
    for (const [tier, n] of Object.entries(TRANSMUTE_COUNTS)) expect(fuseCount(tier)).toBe(n);
  });
});

describe('isFusable', () => {
  it('accepts unlocked gear of the matching tier', () => {
    expect(isFusable(gear('legendary'), 'legendary')).toBe(true);
  });
  it('rejects a locked keeper, a wrong tier, non-gear and nullish', () => {
    expect(isFusable(gear('legendary', { locked: true }), 'legendary')).toBe(false);
    expect(isFusable(gear('epic'), 'legendary')).toBe(false);
    expect(isFusable(junkStack('legendary'), 'legendary')).toBe(false);
    expect(isFusable(null, 'legendary')).toBe(false);
  });
});

describe('transmuteCost', () => {
  it('scales with depth and with the target rarity rank', () => {
    expect(transmuteCost('normal', 1, TIER_ORDER))
      .toBe(Math.round((40 + 1 * 8) * (1 + TIER_ORDER.indexOf('normal') * 0.4)));
    expect(transmuteCost('unique', 10, TIER_ORDER))
      .toBe(Math.round((40 + 10 * 8) * (1 + TIER_ORDER.indexOf('unique') * 0.4)));
  });
  it('is strictly more expensive for a rarer result at the same depth', () => {
    let prev = -1;
    for (let t = 1; t < TIER_ORDER.length; t++) {
      const c = transmuteCost(TIER_ORDER[t], 5, TIER_ORDER);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });
  it('treats a missing/zero maxFloor as floor 1', () => {
    expect(transmuteCost('normal', 0, TIER_ORDER)).toBe(transmuteCost('normal', 1, TIER_ORDER));
    expect(transmuteCost('normal', undefined, TIER_ORDER)).toBe(transmuteCost('normal', 1, TIER_ORDER));
  });
});

describe('fusableByTier', () => {
  it('groups only unlocked gear, and only under its own tier', () => {
    const bag = [
      gear('legendary'), gear('legendary'), gear('legendary', { locked: true }),
      gear('epic'), junkStack('legendary'), null,
    ];
    const by = fusableByTier(bag);
    expect(by.legendary).toEqual([0, 1]); // the locked one, the potion and null are excluded
    expect(by.epic).toEqual([3]);
    expect(by.junk).toBeUndefined();
  });
});

describe('resolveTransmute — explicit selection (per-tier count)', () => {
  it('consumes exactly the chosen ids — 5 for a legendary fuse', () => {
    const bag = many('legendary', 6);
    const ids = bag.slice(0, 5).map(it => it.id);
    const res = resolveTransmute(bag, 'legendary', ids);
    expect(res.ok).toBe(true);
    expect(res.indices.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('only needs 2 for a junk fuse', () => {
    const bag = many('junk', 3);
    const res = resolveTransmute(bag, 'junk', [bag[0].id, bag[2].id]);
    expect(res.ok).toBe(true);
    expect(res.indices.sort((a, b) => a - b)).toEqual([0, 2]);
  });

  it('rejects a selection that is not exactly the tier count', () => {
    const bag = many('legendary', 6);
    // 4 picked for a legendary fuse (needs 5) → fails.
    const four = bag.slice(0, 4).map(it => it.id);
    expect(resolveTransmute(bag, 'legendary', four).ok).toBe(false);
    expect(resolveTransmute(bag, 'legendary', four).reason).toBe('selection');
  });

  it('ignores ids that are locked, wrong-tier, non-gear or duplicated', () => {
    const a = gear('epic'), b = gear('epic'), c = gear('epic'), d = gear('epic');
    const locked = gear('epic', { locked: true });
    const bag = [a, locked, b, c, d];
    // epic needs 4; supply the 4 valid plus a locked id and a duplicate → still ok.
    const res = resolveTransmute(bag, 'epic', [a.id, locked.id, a.id, b.id, c.id, d.id]);
    expect(res.ok).toBe(true);
    expect(res.indices.sort((x, y) => x - y)).toEqual([0, 2, 3, 4]);
  });
});

describe('resolveTransmute — auto-pick fallback (no ids)', () => {
  it('takes the tier-count lowest-value fusable pieces', () => {
    const bag = [
      gear('epic', { value: 50 }), gear('epic', { value: 10 }),
      gear('epic', { value: 30 }), gear('epic', { value: 20 }),
      gear('epic', { value: 40 }), gear('rare', { value: 1 }),
    ];
    const res = resolveTransmute(bag, 'epic'); // epic needs 4
    expect(res.ok).toBe(true);
    // lowest four by value: 10,20,30,40 → indices 1,3,2,4
    expect(res.indices.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('fails when fewer than the tier count fusable pieces exist', () => {
    const bag = many('legendary', 4); // legendary needs 5
    const res = resolveTransmute(bag, 'legendary', []);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('notEnough');
  });

  it('never consumes more than the recipe count', () => {
    const bag = many('legendary', 9);
    expect(resolveTransmute(bag, 'legendary').indices).toHaveLength(5);
  });

  it('refuses to fuse the top rarity (unique) even with plenty on hand', () => {
    const bag = many('unique', 8);
    const res = resolveTransmute(bag, 'unique');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('notEnough');
  });
});
