import { describe, it, expect } from 'vitest';
import {
  STASH_VERSION,
  LEGACY_GOLD_KEY,
  freshStash,
  goldValue,
  materialsValue,
  sanitizeStash,
  mergeStash,
  depositGold,
  withdrawGold,
  depositMaterial,
  withdrawMaterial,
  foldHeroMaterials,
} from '../../src/persistence/stashSync.js';

// A stashed item just needs a gear `slot` and (post-CRDT) a `_st` tag.
function item(tag, extra = {}) { return { slot: 'weapon', name: 'Sword', id: Math.floor(Math.random() * 1e9), _st: tag, ...extra }; }
function v1(gold, items = []) { return { gold, items, ts: 1 }; }        // legacy blob
function v2(dep = {}, wd = {}, items = [], rm = []) {                    // CRDT blob
  const gl = { dep, wd };
  return { v: 2, gl, items, rm, gold: goldValue(gl), ts: 1 };
}

// ═══════════════════════════ basics ═══════════════════════════════════════════

describe('freshStash', () => {
  it('is an empty stash: empty vault AND empty material wallet', () => {
    expect(freshStash()).toEqual({
      v: STASH_VERSION, gold: 0, items: [], ts: 0,
      gl: { dep: {}, wd: {} }, rm: [], ml: {}, materials: {},
    });
  });
});

describe('goldValue', () => {
  it('is Σdeposits − Σwithdrawals, clamped at 0', () => {
    expect(goldValue({ dep: { a: 100, b: 50 }, wd: { a: 30 } })).toBe(120);
    expect(goldValue({ dep: { a: 10 }, wd: { a: 40 } })).toBe(0); // never negative
    expect(goldValue(null)).toBe(0);
  });
});

// ═══════════════════════════ sanitize / migration ═════════════════════════════

describe('sanitizeStash', () => {
  it('migrates a v1 blob: flat gold → shared legacy key, items get deterministic tags', () => {
    const s = sanitizeStash(v1(250, [{ slot: 'helm', id: 7 }, { slot: 'ring', id: 9 }]));
    expect(s.v).toBe(STASH_VERSION);
    expect(s.gl.dep[LEGACY_GOLD_KEY]).toBe(250);
    expect(s.gold).toBe(250);
    expect(s.items).toHaveLength(2);
    expect(s.items[0]._st).toBe('L7');   // deterministic from item id → dedups across devices
    expect(s.items[1]._st).toBe('L9');
  });
  it('is idempotent on a v2 blob (tags and counters preserved)', () => {
    const a = sanitizeStash(v1(100, [{ slot: 'helm', id: 3 }]));
    const b = sanitizeStash(a);
    expect(b).toEqual(a);
  });
  it('coerces junk to a clean empty stash', () => {
    expect(sanitizeStash(null)).toEqual(freshStash());
    expect(sanitizeStash('nope')).toEqual(freshStash());
  });
  it('drops tombstoned and duplicate items, and non-items', () => {
    const s = sanitizeStash({ v: 2, gl: { dep: {}, wd: {} }, rm: ['t2'],
      items: [item('t1'), item('t2'), item('t1'), { name: 'no-slot' }] });
    expect(s.items.map(i => i._st)).toEqual(['t1']); // t2 tombstoned, second t1 duped, no-slot dropped
  });
  it('never double-counts the same v1 balance across two devices (shared legacy key)', () => {
    // PC and phone each migrate their own pre-CRDT stash; the shared legacy key means
    // the merge takes the MAX, not the sum — the player keeps the larger balance, not both.
    const pc = sanitizeStash(v1(100));
    const phone = sanitizeStash(v1(50));
    expect(mergeStash(pc, phone).gold).toBe(100);
  });
});

// ═══════════════════════════ merge: the CRDT guarantees ═══════════════════════

describe('mergeStash — no concurrent deposit is ever lost', () => {
  it('sums independent gold deposits from two devices', () => {
    // Both start from a shared 100, then each deposits offline; nothing is lost.
    const base = depositGold(freshStash(), '_legacy', 100);
    const pc = depositGold(sanitizeStash(base), 'pc', 40);      // 140 on PC
    const phone = depositGold(sanitizeStash(base), 'phone', 25); // 125 on phone
    const merged = mergeStash(pc, phone);
    expect(merged.gold).toBe(165);                              // 100 + 40 + 25 — both deposits survive
  });
  it('unions items deposited independently on two devices', () => {
    const a = v2({}, {}, [item('a1')], []);
    const b = v2({}, {}, [item('b1')], []);
    const merged = mergeStash(a, b);
    expect(merged.items.map(i => i._st).sort()).toEqual(['a1', 'b1']);
  });
});

describe('mergeStash — withdrawals win and never resurrect', () => {
  it('a withdrawal on one device removes the item even though the other still holds it', () => {
    // A withdrew item t1 (tombstoned); B is stale and still lists t1. Merge must NOT
    // resurrect it.
    const a = v2({}, {}, [], ['t1']);              // A withdrew t1
    const b = v2({}, {}, [item('t1')], []);        // B still has t1
    expect(mergeStash(a, b).items).toHaveLength(0);
    expect(mergeStash(b, a).items).toHaveLength(0); // order-independent
  });
  it('subtracts withdrawn gold across devices', () => {
    const a = v2({ _legacy: 100 }, { pc: 30 });    // PC withdrew 30
    const b = v2({ _legacy: 100 }, { phone: 20 }); // phone withdrew 20
    expect(mergeStash(a, b).gold).toBe(50);        // 100 − 30 − 20
  });
  it('a re-deposited item (fresh tag) survives a prior withdrawal of the same item', () => {
    // Old tag t1 stays tombstoned; the re-deposit carries a new tag t2 and lives.
    const a = v2({}, {}, [item('t2')], ['t1']);
    const b = v2({}, {}, [], ['t1']);
    expect(mergeStash(a, b).items.map(i => i._st)).toEqual(['t2']);
  });
});

describe('mergeStash — CRDT algebra (commutative / associative / idempotent)', () => {
  const a = v2({ x: 10 }, { x: 2 }, [item('a1'), item('a2')], ['ra']);
  const b = v2({ y: 5 }, {}, [item('b1')], ['rb', 'a2']); // b tombstoned a2
  const c = v2({ x: 12, z: 3 }, { y: 1 }, [item('c1')], []);
  const norm = s => ({ gl: s.gl, rm: s.rm.slice().sort(), items: s.items.map(i => i._st).sort(), gold: s.gold });

  it('is commutative', () => {
    expect(norm(mergeStash(a, b))).toEqual(norm(mergeStash(b, a)));
  });
  it('is associative', () => {
    expect(norm(mergeStash(mergeStash(a, b), c))).toEqual(norm(mergeStash(a, mergeStash(b, c))));
  });
  it('is idempotent', () => {
    const m = mergeStash(a, b);
    expect(norm(mergeStash(m, m))).toEqual(norm(m));
    expect(norm(mergeStash(m, a))).toEqual(norm(m)); // re-merging a subsumed input changes nothing
  });
  it('takes the per-device MAX of counters', () => {
    expect(mergeStash(a, c).gl.dep.x).toBe(12); // max(10, 12)
  });
});

describe('mergeStash — tombstone growth is bounded', () => {
  it('caps retained tombstones at rmCap without dropping any live item', () => {
    const rm = [];
    for (let i = 0; i < 20; i++) rm.push('t' + i);
    const a = v2({}, {}, [item('live1'), item('live2')], rm);
    const merged = mergeStash(a, freshStash(), { rmCap: 5 });
    expect(merged.rm).toHaveLength(5);
    expect(merged.items.map(i => i._st).sort()).toEqual(['live1', 'live2']); // live items untouched
  });
});

// ═══════════════════════════ gold operations ══════════════════════════════════

describe('depositGold / withdrawGold', () => {
  it('accumulate per-device and re-materialize gold', () => {
    let s = freshStash();
    s = depositGold(s, 'pc', 100);
    s = withdrawGold(s, 'pc', 30);
    expect(s.gl.dep.pc).toBe(100);
    expect(s.gl.wd.pc).toBe(30);
    expect(s.gold).toBe(70);
  });
  it('ignore non-positive amounts', () => {
    let s = depositGold(freshStash(), 'pc', 0);
    s = withdrawGold(s, 'pc', -5);
    expect(s.gold).toBe(0);
    expect(s.gl.dep).toEqual({});
  });
});

// ═══════════════════════════ crafting materials ═══════════════════════════════

describe('materialsValue', () => {
  it('materialises every ledger to Σdep − Σwd, clamped at 0', () => {
    const ml = {
      scrap: { dep: { a: 40, b: 10 }, wd: { a: 5 } },
      core:  { dep: { a: 3 }, wd: { a: 9 } }, // over-withdrawn → clamps to 0
    };
    expect(materialsValue(ml)).toEqual({ scrap: 45, core: 0 });
    expect(materialsValue(null)).toEqual({});
  });
});

describe('depositMaterial / withdrawMaterial', () => {
  it('accumulate per-device, per-key, and re-materialize the wallet', () => {
    let s = freshStash();
    s = depositMaterial(s, 'scrap', 'pc', 100);
    s = withdrawMaterial(s, 'scrap', 'pc', 30);
    s = depositMaterial(s, 'glimmer', 'pc', 7);
    expect(s.ml.scrap.dep.pc).toBe(100);
    expect(s.ml.scrap.wd.pc).toBe(30);
    expect(s.materials).toEqual({ scrap: 70, glimmer: 7 });
  });
  it('ignore non-positive amounts (no phantom keys)', () => {
    let s = depositMaterial(freshStash(), 'scrap', 'pc', 0);
    s = withdrawMaterial(s, 'core', 'pc', -5);
    expect(s.materials).toEqual({});
    expect(s.ml).toEqual({});
  });
});

describe('foldHeroMaterials — one-time migration of per-hero wallets', () => {
  it('sums DIFFERENT heroes and takes the MAX for the SAME hero (idempotent)', () => {
    let s = freshStash();
    foldHeroMaterials(s, 'HheroA', { scrap: 100, core: 2 });
    foldHeroMaterials(s, 'HheroB', { scrap: 50 });
    expect(s.materials).toEqual({ scrap: 150, core: 2 }); // different heroes sum
    // Re-running the same hero (another device that synced it) must not double-count.
    foldHeroMaterials(s, 'HheroA', { scrap: 100, core: 2 });
    expect(s.materials).toEqual({ scrap: 150, core: 2 });
    // A larger later balance for the same hero wins (MAX), still no double-count.
    foldHeroMaterials(s, 'HheroA', { scrap: 130, core: 2 });
    expect(s.materials).toEqual({ scrap: 180, core: 2 });
  });
  it('leaves real spends intact when re-folded', () => {
    let s = freshStash();
    foldHeroMaterials(s, 'HheroA', { scrap: 100 });
    withdrawMaterial(s, 'scrap', 'pc', 40); // spent 40 → 60 on hand
    expect(s.materials.scrap).toBe(60);
    foldHeroMaterials(s, 'HheroA', { scrap: 100 }); // idempotent re-fold on next boot
    expect(s.materials.scrap).toBe(60);
  });
});

describe('mergeStash — materials merge with no loss, like gold', () => {
  it('sums independent material gains from two devices', () => {
    const base = depositMaterial(freshStash(), 'scrap', '_legacy', 100);
    const pc = depositMaterial(sanitizeStash(base), 'scrap', 'pc', 40);      // 140 on PC
    const phone = depositMaterial(sanitizeStash(base), 'scrap', 'phone', 25); // 125 on phone
    expect(mergeStash(pc, phone).materials.scrap).toBe(165);                  // both gains survive
  });
  it('subtracts spends across devices and merges distinct material keys', () => {
    const a = depositMaterial(freshStash(), 'scrap', '_legacy', 100);
    withdrawMaterial(a, 'scrap', 'pc', 30);                    // PC spent 30
    const b = depositMaterial(freshStash(), 'glimmer', 'phone', 9); // phone gained a different mat
    const m = mergeStash(a, b);
    expect(m.materials).toEqual({ scrap: 70, glimmer: 9 });
  });
  it('takes the per-device MAX of a material counter', () => {
    const a = depositMaterial(freshStash(), 'core', 'x', 10);
    const c = depositMaterial(freshStash(), 'core', 'x', 12);
    expect(mergeStash(a, c).ml.core.dep.x).toBe(12);          // max(10, 12), not 22
    expect(mergeStash(a, c).materials.core).toBe(12);
  });
});
