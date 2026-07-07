import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/rng.js';
import { PANTHEON } from '../../src/data/pinnacle.js';
import {
  bossById,
  baseBosses,
  uberFor,
  summonCost,
  canSummon,
  previewLootPool,
  rollPinnacleDrop,
  nextBossPity,
  firstClearReward,
  uberUnlocked,
} from '../../src/systems/pinnacle.js';

// A minimal, fully-controlled bespoke roster to exercise the injectable `data` path
// without depending on the live tuning numbers.
const T_BOSS = {
  id: 'testGod', name: 'Test God', atlasKey: 'x', tier: 'base', uberOf: null, uberMinEndlessDepth: 0,
  summon: { shards: { type: 'testShard', count: 5 }, gold: 1000, chaos: 2 },
  arena: { w: 20, h: 20 }, hp: { mult: 5 },
  phases: [{ id: 'p0', atHpFrac: 1.0, telegraphs: [{ id: 't', kind: 'disc', windupSec: 1, damageMult: 1 }] }],
  loot: { pool: ['itemA', 'itemB'], pityThreshold: 3, dropChance: 0.5 },
  bossPointPayout: 2,
  firstClearBonus: { gold: 500, shards: { type: 'testShard', count: 3 }, chaos: 1 },
};
const T_UBER = {
  id: 'testGodUber', name: 'Test God Uber', atlasKey: 'x', tier: 'uber', uberOf: 'testGod', uberMinEndlessDepth: 50,
  summon: { shards: { type: 'testShard', count: 20 }, gold: 5000, chaos: 8 },
  arena: { w: 26, h: 26 }, hp: { mult: 15 },
  phases: [{ id: 'p0', atHpFrac: 1.0, telegraphs: [{ id: 't', kind: 'disc', windupSec: 1, damageMult: 1 }] }],
  loot: { pool: ['itemA', 'itemB', 'itemC'], pityThreshold: 2, dropChance: 0.7 },
  bossPointPayout: 6,
  firstClearBonus: { gold: 3000 },
};
const DATA = [T_BOSS, T_UBER];

describe('bossById', () => {
  it('finds a god by id in the given roster', () => {
    expect(bossById('testGod', DATA)).toBe(T_BOSS);
    expect(bossById('thallor').id).toBe('thallor'); // defaults to live PANTHEON
  });
  it('returns null for unknown / garbage', () => {
    expect(bossById('nope', DATA)).toBe(null);
    expect(bossById(null, DATA)).toBe(null);
    expect(bossById('testGod', null)).toBe(null);
  });
});

describe('baseBosses', () => {
  it('returns only base-tier gods', () => {
    const b = baseBosses(DATA);
    expect(b).toHaveLength(1);
    expect(b[0].id).toBe('testGod');
  });
  it('the live roster exposes six bases', () => {
    expect(baseBosses().every((b) => b.tier === 'base')).toBe(true);
    expect(baseBosses()).toHaveLength(6);
  });
  it('is [] for garbage data', () => {
    expect(baseBosses(null)).toEqual([]);
    expect(baseBosses(42)).toEqual([]);
  });
});

describe('uberFor', () => {
  it('returns the uber that ascends from a base', () => {
    expect(uberFor('testGod', DATA)).toBe(T_UBER);
  });
  it('null for a base with no uber / unknown / garbage', () => {
    expect(uberFor('testGodUber', DATA)).toBe(null); // an uber has no uber
    expect(uberFor('nope', DATA)).toBe(null);
    expect(uberFor(null)).toBe(null);
  });
  it('every live base has a resolvable uber', () => {
    for (const base of baseBosses()) {
      const u = uberFor(base.id);
      expect(u).not.toBe(null);
      expect(u.uberOf).toBe(base.id);
    }
  });
});

describe('summonCost', () => {
  it('returns the recipe for a known god', () => {
    expect(summonCost('testGod', DATA)).toBe(T_BOSS.summon);
  });
  it('null for unknown', () => {
    expect(summonCost('nope', DATA)).toBe(null);
  });
});

describe('canSummon', () => {
  const recipe = T_BOSS.summon; // gold 1000, chaos 2, shards testShard x5
  it('true when the wallet covers gold + chaos + the shard count', () => {
    const wallet = { gold: 1000, chaos: 2, shards: { testShard: 5 } };
    expect(canSummon(recipe, wallet)).toBe(true);
    // surplus is fine
    expect(canSummon(recipe, { gold: 9999, chaos: 9, shards: { testShard: 50 } })).toBe(true);
  });
  it('false when any single currency is short', () => {
    expect(canSummon(recipe, { gold: 999, chaos: 2, shards: { testShard: 5 } })).toBe(false);
    expect(canSummon(recipe, { gold: 1000, chaos: 1, shards: { testShard: 5 } })).toBe(false);
    expect(canSummon(recipe, { gold: 1000, chaos: 2, shards: { testShard: 4 } })).toBe(false);
    expect(canSummon(recipe, { gold: 1000, chaos: 2, shards: {} })).toBe(false);
  });
  it('a recipe with no chaos cost never blocks on chaos', () => {
    const noChaos = { shards: { type: 'testShard', count: 5 }, gold: 1000 };
    expect(canSummon(noChaos, { gold: 1000, shards: { testShard: 5 } })).toBe(true);
  });
  it('treats missing / garbage wallet fields as zero owned', () => {
    expect(canSummon(recipe, null)).toBe(false);
    expect(canSummon(recipe, {})).toBe(false);
    expect(canSummon(recipe, { gold: NaN, chaos: 2, shards: { testShard: 5 } })).toBe(false);
    expect(canSummon(recipe, { gold: -5, chaos: 2, shards: { testShard: 5 } })).toBe(false);
    expect(canSummon(recipe, { gold: 1000, chaos: 2, shards: 'oops' })).toBe(false);
  });
  it('false for a garbage recipe', () => {
    expect(canSummon(null, { gold: 1e9 })).toBe(false);
    expect(canSummon(42, { gold: 1e9 })).toBe(false);
  });
});

describe('previewLootPool', () => {
  it('returns a copy of the pool + threshold', () => {
    const p = previewLootPool('testGod', DATA);
    expect(p.pool).toEqual(['itemA', 'itemB']);
    expect(p.pool).not.toBe(T_BOSS.loot.pool); // copy, not the live array
    expect(p.pityThreshold).toBe(3);
  });
  it('safe empty result for an unknown god', () => {
    const p = previewLootPool('nope', DATA);
    expect(p.pool).toEqual([]);
    expect(p.pityThreshold).toBeGreaterThanOrEqual(1);
  });
});

describe('rollPinnacleDrop + pity via the shared module', () => {
  it('guarantees a drop once pity reaches the threshold', () => {
    // pity 3 == threshold ⇒ guaranteed regardless of dropChance/rng.
    const r = rollPinnacleDrop(T_BOSS.loot.pool, 3, () => 0.999, T_BOSS);
    expect(r.guaranteed).toBe(true);
    expect(T_BOSS.loot.pool).toContain(r.itemId);
  });
  it('below threshold, respects dropChance on the injected rng', () => {
    // dropChance 0.5: a 0.2 roll drops, a 0.9 roll does not.
    const hit = rollPinnacleDrop(T_BOSS.loot.pool, 0, seqRng([0.2, 0.0]), T_BOSS);
    expect(hit.guaranteed).toBe(false);
    expect(hit.itemId).toBe('itemA'); // second draw 0.0 → index 0

    const miss = rollPinnacleDrop(T_BOSS.loot.pool, 0, seqRng([0.9]), T_BOSS);
    expect(miss.itemId).toBe(null);
    expect(miss.guaranteed).toBe(false);
  });
  it('is deterministic under a seeded stream', () => {
    const a = rollPinnacleDrop(T_BOSS.loot.pool, 1, mulberry32(7), T_BOSS);
    const b = rollPinnacleDrop(T_BOSS.loot.pool, 1, mulberry32(7), T_BOSS);
    expect(a).toEqual(b);
  });
  it('picks across the whole pool as the second draw sweeps [0,1)', () => {
    // Force a drop (first draw 0 < 0.5), vary the pick draw.
    const lo = rollPinnacleDrop(['x', 'y', 'z'], 0, seqRng([0, 0.0]), T_BOSS);
    const hi = rollPinnacleDrop(['x', 'y', 'z'], 0, seqRng([0, 0.999]), T_BOSS);
    expect(lo.itemId).toBe('x');
    expect(hi.itemId).toBe('z'); // clamps to last index, never overruns
  });
  it('never drops from an empty pool, even when pity would guarantee', () => {
    const r = rollPinnacleDrop([], 99, () => 0, T_BOSS);
    expect(r.itemId).toBe(null);
    expect(r.guaranteed).toBe(false);
  });
  it('tolerates garbage rng / pool', () => {
    const r = rollPinnacleDrop(null, 0, null, T_BOSS);
    expect(r.itemId).toBe(null);
  });
});

describe('nextBossPity', () => {
  it('resets to 0 on a drop, ticks up on a dry kill', () => {
    expect(nextBossPity(2, true, T_BOSS)).toBe(0);
    expect(nextBossPity(2, false, T_BOSS)).toBe(3);
  });
  it('clamps garbage to a clean integer', () => {
    expect(nextBossPity(-4, false, T_BOSS)).toBe(1);
    expect(nextBossPity(NaN, false, T_BOSS)).toBe(1);
    expect(nextBossPity(1.9, false, T_BOSS)).toBe(2);
  });
});

describe('firstClearReward', () => {
  it('normalizes the bonus + folds in the boss-point payout', () => {
    const r = firstClearReward(T_BOSS);
    expect(r).toEqual({
      gold: 500,
      chaos: 1,
      shards: { type: 'testShard', count: 3 },
      bossPoints: 2,
    });
  });
  it('supplies safe zero defaults for a bonus-less def', () => {
    const r = firstClearReward({ bossPointPayout: 6, firstClearBonus: {} });
    expect(r).toEqual({ gold: 0, chaos: 0, shards: null, bossPoints: 6 });
  });
  it('tolerates a fully garbage boss', () => {
    expect(firstClearReward(null)).toEqual({ gold: 0, chaos: 0, shards: null, bossPoints: 0 });
  });
});

describe('uberUnlocked', () => {
  it('a base def is always "unlocked" (gating does not apply)', () => {
    expect(uberUnlocked(T_BOSS, false, 0)).toBe(true);
  });
  it('an uber needs BOTH the base cleared AND the min Endless depth', () => {
    expect(uberUnlocked(T_UBER, false, 999)).toBe(false); // base not cleared
    expect(uberUnlocked(T_UBER, true, 49)).toBe(false);   // one short of depth 50
    expect(uberUnlocked(T_UBER, true, 50)).toBe(true);    // exactly at gate
    expect(uberUnlocked(T_UBER, true, 200)).toBe(true);
  });
  it('garbage depth reads as locked, never unlocked by NaN', () => {
    expect(uberUnlocked(T_UBER, true, NaN)).toBe(false);
    expect(uberUnlocked(T_UBER, true, undefined)).toBe(false);
  });
  it('false for a garbage def', () => {
    expect(uberUnlocked(null, true, 999)).toBe(false);
  });
  it('every live uber is gated behind a real depth', () => {
    for (const base of baseBosses()) {
      const u = uberFor(base.id);
      expect(uberUnlocked(u, true, 0)).toBe(false); // depth 0 never unlocks an uber
      expect(uberUnlocked(u, true, u.uberMinEndlessDepth)).toBe(true);
    }
  });
});

// A tiny sequenced rng: yields the given values in order, then 0 forever.
function seqRng(values) {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}
