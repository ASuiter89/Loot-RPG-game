import { describe, it, expect } from 'vitest';
import {
  STASH_VERSION,
  LEGACY_GOLD_KEY,
  freshStash,
  goldValue,
  sanitizeStash,
  mergeStash,
  depositGold,
  withdrawGold,
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
  it('is an empty v2 stash', () => {
    expect(freshStash()).toEqual({ v: 2, gold: 0, items: [], ts: 0, gl: { dep: {}, wd: {} }, rm: [] });
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
