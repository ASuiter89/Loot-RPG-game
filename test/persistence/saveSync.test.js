import { describe, it, expect } from 'vitest';
import {
  freshDelMeta,
  sanitizeDelMeta,
  isTombstoned,
  addTombstone,
  mergeDelMeta,
  delCloudHasAll,
  freshHcMeta,
  sanitizeHcMeta,
  mergeHcMeta,
  hcMetaCloudHasAll,
  sanitizeGrave,
  graveKey,
  graveOrder,
  mergeGraveyard,
  graveyardCloudHasAll,
  planReconcile,
  planSlotPush,
} from '../../src/persistence/saveSync.js';

// ── Test doubles: minimal stand-ins for the legacy shell's own predicates ─────
const isStarted = d => !!(d && d.player && (d.player.class || (d.player.level || 1) > 1 || (d.player.gold || 0) > 0));
const cidOf = d => (d && d.player && d.player.cid) || null;
const lowestFree = used => { let i = 0; while (used.has(i)) i++; return i; };

// Build a started-hero save. cid=null makes a legacy (id-less) save.
function hero(cid, ts, extra = {}) {
  return { player: { class: 'warrior', cid: cid || undefined, ...extra }, ts };
}
function blank() { return { player: { class: null, level: 1, gold: 0 } }; }

// The game's clock-skew-proof comparator: monotonic play-time first, ts as tiebreak.
const playOrder = (a, b) => {
  const pa = (a && a.player && a.player.playMs) || 0;
  const pb = (b && b.player && b.player.playMs) || 0;
  if (pa !== pb) return pa - pb;
  return ((a && a.ts) || 0) - ((b && b.ts) || 0);
};

// A plan builder wired with the standard predicates; dead/deleted are cid sets.
// Pass `order` to exercise the clock-skew-proof comparator (default: ts only).
function plan(cloudRows, localRows, { activeSlot = 0, dead = [], deleted = [], order } = {}) {
  const deadSet = new Set(dead);
  const delSet = new Set(deleted);
  return planReconcile({
    cloudRows,
    localRows,
    activeSlot,
    isStarted,
    cidOf,
    isDead: d => !!(d && d.player && d.player.cid && deadSet.has(d.player.cid)),
    isDeleted: d => !!(d && d.player && d.player.cid && delSet.has(d.player.cid)),
    lowestFree,
    ...(order ? { saveOrder: order } : {}),
  });
}

// ═══════════════════════ deletion-tombstone ledger ═══════════════════════════

describe('freshDelMeta', () => {
  it('is an empty, unstamped ledger', () => {
    expect(freshDelMeta()).toEqual({ cids: [], ts: 0 });
  });
});

describe('sanitizeDelMeta', () => {
  it('coerces junk to a clean ledger', () => {
    expect(sanitizeDelMeta(null)).toEqual({ cids: [], ts: 0 });
    expect(sanitizeDelMeta('nope')).toEqual({ cids: [], ts: 0 });
    expect(sanitizeDelMeta({})).toEqual({ cids: [], ts: 0 });
  });
  it('keeps only string cids and a non-negative integer ts', () => {
    expect(sanitizeDelMeta({ cids: ['a', 2, null, 'b', {}], ts: 12.9 })).toEqual({ cids: ['a', 'b'], ts: 12 });
    expect(sanitizeDelMeta({ cids: 'x', ts: -5 })).toEqual({ cids: [], ts: 0 });
  });
});

describe('isTombstoned', () => {
  it('is true only for a cid present in the ledger', () => {
    const m = { cids: ['c1', 'c2'], ts: 1 };
    expect(isTombstoned(m, 'c1')).toBe(true);
    expect(isTombstoned(m, 'c3')).toBe(false);
  });
  it('a falsy cid is never tombstoned', () => {
    expect(isTombstoned({ cids: ['c1'] }, null)).toBe(false);
    expect(isTombstoned({ cids: ['c1'] }, '')).toBe(false);
    expect(isTombstoned({ cids: ['c1'] }, undefined)).toBe(false);
  });
});

describe('addTombstone', () => {
  it('appends a new cid and stamps ts, without mutating the input', () => {
    const before = { cids: ['a'], ts: 1 };
    const { meta, added } = addTombstone(before, 'b', 99);
    expect(added).toBe(true);
    expect(meta).toEqual({ cids: ['a', 'b'], ts: 99 });
    expect(before).toEqual({ cids: ['a'], ts: 1 }); // untouched
  });
  it('is idempotent for an already-tombstoned cid', () => {
    const { meta, added } = addTombstone({ cids: ['a'], ts: 5 }, 'a', 99);
    expect(added).toBe(false);
    expect(meta.cids).toEqual(['a']);
  });
  it('ignores a falsy cid', () => {
    expect(addTombstone({ cids: [], ts: 0 }, null, 99).added).toBe(false);
    expect(addTombstone(null, '', 99).added).toBe(false);
  });
});

describe('mergeDelMeta', () => {
  it('unions cloud cids into local and reports growth', () => {
    const { meta, grew } = mergeDelMeta({ cids: ['a'], ts: 1 }, { cids: ['a', 'b'], ts: 2 }, 100);
    expect(grew).toBe(true);
    expect(meta.cids.sort()).toEqual(['a', 'b']);
    expect(meta.ts).toBe(100); // stamped fresh on growth
  });
  it('never shrinks — a stale cloud copy cannot erase a local tombstone', () => {
    const { meta, grew } = mergeDelMeta({ cids: ['a', 'b'], ts: 5 }, { cids: ['a'], ts: 1 }, 100);
    expect(grew).toBe(false);
    expect(meta.cids.sort()).toEqual(['a', 'b']);
    expect(meta.ts).toBe(5); // max of the two when nothing new arrived
  });
  it('is idempotent when both sides already agree', () => {
    const { meta, grew } = mergeDelMeta({ cids: ['a'], ts: 3 }, { cids: ['a'], ts: 2 }, 100);
    expect(grew).toBe(false);
    expect(meta.cids).toEqual(['a']);
    expect(meta.ts).toBe(3);
  });
  it('handles missing/blank cloud rows', () => {
    const { meta, grew } = mergeDelMeta({ cids: ['a'], ts: 3 }, null, 100);
    expect(grew).toBe(false);
    expect(meta.cids).toEqual(['a']);
  });
});

describe('delCloudHasAll', () => {
  it('is true when the cloud already holds every local cid', () => {
    expect(delCloudHasAll({ cids: ['a'] }, { cids: ['a', 'b'] })).toBe(true);
    expect(delCloudHasAll({ cids: [] }, { cids: [] })).toBe(true);
  });
  it('is false when the local ledger has a cid the cloud lacks', () => {
    expect(delCloudHasAll({ cids: ['a', 'c'] }, { cids: ['a', 'b'] })).toBe(false);
  });
});

// ══════════════════════ account-wide meta ledger (feats) ═════════════════════

describe('freshHcMeta', () => {
  it('is a blank ledger with all three sets present', () => {
    expect(freshHcMeta()).toEqual({ cids: [], ach: [], nach: [], ts: 0 });
  });
});

describe('sanitizeHcMeta', () => {
  it('coerces junk into a clean ledger and keeps only string ids', () => {
    expect(sanitizeHcMeta(null)).toEqual({ cids: [], ach: [], nach: [], ts: 0 });
    expect(sanitizeHcMeta({ cids: ['a', 5, null], ach: ['x'], nach: ['n', {}], ts: 9.7 }))
      .toEqual({ cids: ['a'], ach: ['x'], nach: ['n'], ts: 9 });
  });
  it('defaults nach to [] for a legacy blob that predates normal-mode feats', () => {
    // A row written before account-wide Kitten feats existed carries only cids/ach.
    expect(sanitizeHcMeta({ cids: ['a'], ach: ['x'], ts: 3 }))
      .toEqual({ cids: ['a'], ach: ['x'], nach: [], ts: 3 });
  });
});

describe('mergeHcMeta', () => {
  it('unions all three sets and stamps a fresh ts on growth', () => {
    const { meta, grew, learnedDeath } = mergeHcMeta(
      { cids: ['d1'], ach: ['a1'], nach: ['n1'], ts: 1 },
      { cids: ['d1', 'd2'], ach: ['a2'], nach: ['n1', 'n2'], ts: 2 },
      100,
    );
    expect(grew).toBe(true);
    expect(learnedDeath).toBe(true); // a new death cid (d2) arrived
    expect(meta.cids.sort()).toEqual(['d1', 'd2']);
    expect(meta.ach.sort()).toEqual(['a1', 'a2']);
    expect(meta.nach.sort()).toEqual(['n1', 'n2']);
    expect(meta.ts).toBe(100);
  });
  it('reports growth from a NEW normal feat without flagging a death', () => {
    // The core account-wide-achievements case: another slot earned a Kitten feat.
    const { meta, grew, learnedDeath } = mergeHcMeta(
      { cids: [], ach: [], nach: ['n1'], ts: 5 },
      { cids: [], ach: [], nach: ['n1', 'n2'], ts: 6 },
      200,
    );
    expect(grew).toBe(true);
    expect(learnedDeath).toBe(false);
    expect(meta.nach.sort()).toEqual(['n1', 'n2']);
  });
  it('never shrinks — a stale cloud copy cannot erase a local feat', () => {
    const { meta, grew } = mergeHcMeta(
      { cids: [], ach: ['a1', 'a2'], nach: ['n1', 'n2'], ts: 5 },
      { cids: [], ach: ['a1'], nach: ['n1'], ts: 1 },
      100,
    );
    expect(grew).toBe(false);
    expect(meta.ach.sort()).toEqual(['a1', 'a2']);
    expect(meta.nach.sort()).toEqual(['n1', 'n2']);
    expect(meta.ts).toBe(5); // max of the two when nothing new arrived
  });
  it('is idempotent and handles a missing cloud row', () => {
    const local = { cids: ['d1'], ach: ['a1'], nach: ['n1'], ts: 3 };
    const { meta, grew, learnedDeath } = mergeHcMeta(local, null, 100);
    expect(grew).toBe(false);
    expect(learnedDeath).toBe(false);
    expect(meta).toEqual({ cids: ['d1'], ach: ['a1'], nach: ['n1'], ts: 3 });
  });
  it('does not mutate its inputs', () => {
    const local = { cids: [], ach: [], nach: ['n1'], ts: 1 };
    mergeHcMeta(local, { nach: ['n2'] }, 100);
    expect(local.nach).toEqual(['n1']);
  });
});

describe('hcMetaCloudHasAll', () => {
  it('is true only when the cloud holds every local cid, ach AND nach', () => {
    expect(hcMetaCloudHasAll(
      { cids: ['d1'], ach: ['a1'], nach: ['n1'] },
      { cids: ['d1', 'd2'], ach: ['a1'], nach: ['n1', 'n2'] },
    )).toBe(true);
    expect(hcMetaCloudHasAll(freshHcMeta(), null)).toBe(true); // nothing to push
  });
  it('is false when the cloud is missing a normal feat we hold (forces a push)', () => {
    expect(hcMetaCloudHasAll(
      { cids: [], ach: [], nach: ['n1', 'n2'] },
      { cids: [], ach: [], nach: ['n1'] },
    )).toBe(false);
  });
});

// ═══════════════════════════ graveyard (History) ═════════════════════════════

// One headstone. cid=null makes a legacy (pre-cid) record.
function grave(cid, ts, extra = {}) {
  return { cid: cid || null, name: 'Hero', cls: 'warrior', level: 5, floor: 3, gold: 10, playMs: 1000, ts, ...extra };
}

describe('sanitizeGrave', () => {
  it('normalizes cid, ts and playMs while preserving other fields', () => {
    const g = sanitizeGrave({ cid: 'c1', name: 'Bob', level: 7, ts: 12.9, playMs: 500, hardcore: true });
    expect(g.cid).toBe('c1');
    expect(g.ts).toBe(12);       // floored
    expect(g.playMs).toBe(500);
    expect(g.name).toBe('Bob');  // untouched pass-through
    expect(g.hardcore).toBe(true);
  });
  it('coerces a missing/blank cid to null and bad numbers to 0', () => {
    const g = sanitizeGrave({ cid: '', ts: NaN, playMs: undefined });
    expect(g.cid).toBe(null);
    expect(g.ts).toBe(0);
    expect(g.playMs).toBe(0);
  });
  it('returns null for a non-object', () => {
    expect(sanitizeGrave(null)).toBe(null);
    expect(sanitizeGrave(42)).toBe(null);
  });
});

describe('graveKey', () => {
  it('keys a cid-bearing record by its cid', () => {
    expect(graveKey({ cid: 'c1', name: 'A' })).toBe('cid:c1');
  });
  it('keys a legacy id-less record by a content signature', () => {
    const a = graveKey({ cid: null, name: 'A', cls: 'mage', level: 3, floor: 2, gold: 4, ts: 9 });
    const b = graveKey({ cid: null, name: 'A', cls: 'mage', level: 3, floor: 2, gold: 4, ts: 9 });
    expect(a).toBe(b);           // identical legacy records collide (dedupe)
    expect(a).not.toBe(graveKey({ cid: null, name: 'B', cls: 'mage', level: 3, floor: 2, gold: 4, ts: 9 }));
  });
});

describe('graveOrder', () => {
  it('ranks the more-played snapshot fresher, ts only as a tiebreak', () => {
    expect(graveOrder({ playMs: 200, ts: 1 }, { playMs: 100, ts: 9 })).toBeGreaterThan(0);
    expect(graveOrder({ playMs: 100, ts: 9 }, { playMs: 100, ts: 5 })).toBeGreaterThan(0);
    expect(graveOrder({ playMs: 100, ts: 5 }, { playMs: 100, ts: 5 })).toBe(0);
  });
});

describe('mergeGraveyard', () => {
  it('unions runs from both devices, newest-first', () => {
    const local = [grave('c1', 30), grave('c2', 10)];
    const cloud = [grave('c3', 20)];
    const { graves, grew } = mergeGraveyard(local, cloud, 200);
    expect(grew).toBe(true);
    expect(graves.map(g => g.cid)).toEqual(['c1', 'c3', 'c2']); // sorted by ts desc
  });
  it('dedupes a shared hero, keeping the MORE-PLAYED snapshot', () => {
    const local = [grave('c1', 50, { playMs: 1000, level: 8 })];
    const cloud = [grave('c1', 20, { playMs: 4000, level: 14 })]; // earlier ts but far more play-time
    const { graves } = mergeGraveyard(local, cloud, 200);
    expect(graves).toHaveLength(1);
    expect(graves[0].playMs).toBe(4000);
    expect(graves[0].level).toBe(14);
  });
  it('reports grew=false when the cloud adds nothing new', () => {
    const local = [grave('c1', 30), grave('c2', 10)];
    const cloud = [grave('c1', 30)];
    const { grew } = mergeGraveyard(local, cloud, 200);
    expect(grew).toBe(false);
  });
  it('caps the merged list to the newest N and reports growth on a dropped tail', () => {
    const local = [grave('c1', 100), grave('c2', 90)];
    const cloud = [grave('c3', 80)];
    const { graves } = mergeGraveyard(local, cloud, 2);
    expect(graves.map(g => g.cid)).toEqual(['c1', 'c2']); // oldest (c3) capped off
  });
  it('does not mutate its inputs', () => {
    const local = [grave('c1', 30)];
    mergeGraveyard(local, [grave('c2', 40)], 200);
    expect(local).toHaveLength(1);
  });
  it('converges: re-merging the result with the cloud is a no-op', () => {
    const local = [grave('c1', 30)];
    const cloud = [grave('c2', 40)];
    const first = mergeGraveyard(local, cloud, 200);
    const second = mergeGraveyard(first.graves, cloud, 200);
    expect(second.grew).toBe(false);
    expect(second.graves.map(g => g.cid)).toEqual(first.graves.map(g => g.cid));
  });
});

describe('graveyardCloudHasAll', () => {
  it('is true when the cloud holds every local run at a version no older', () => {
    expect(graveyardCloudHasAll([grave('c1', 10)], [grave('c1', 10), grave('c2', 20)])).toBe(true);
    expect(graveyardCloudHasAll([], null)).toBe(true); // nothing to push
  });
  it('is false when the cloud is missing a run we hold (forces a push)', () => {
    expect(graveyardCloudHasAll([grave('c1', 10), grave('c2', 20)], [grave('c1', 10)])).toBe(false);
  });
  it('is false when the cloud holds an OLDER snapshot of a shared run', () => {
    expect(graveyardCloudHasAll(
      [grave('c1', 50, { playMs: 4000 })],
      [grave('c1', 20, { playMs: 1000 })],
    )).toBe(false);
  });
});

// ═══════════════════════════ planReconcile ═══════════════════════════════════

describe('planReconcile — the deletion-resurrection fix', () => {
  it('scrubs a tombstoned local hero the cloud no longer has (never resurrects it)', () => {
    // The reported bug: PC deleted hero A (cloud row gone, cid tombstoned). Mobile
    // still holds A locally. Without the tombstone, A would be a "newcomer" and get
    // pushed back up. With it, A is scrubbed locally and never uploaded.
    const cloudRows = [{ slot: 1, data: hero('B', 200) }];
    const localRows = [{ slot: 0, data: hero('A', 100) }, { slot: 1, data: hero('B', 200) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0, deleted: ['A'] });
    expect(p.localRemovals).toContain(0);          // A scrubbed on mobile
    expect(p.uploads).not.toContain(0);            // A never re-uploaded
    expect(p.uploads.some(s => s === 1)).toBe(false); // B already matches cloud
    // A occupied the active slot, so the caller reloads into a fresh hero.
    expect(p.activeChanged).toBe(true);
  });

  it('deletes a tombstoned hero still present in the cloud', () => {
    // Mobile deleted A (tombstone synced) but the cloud row lingers (e.g. the DELETE
    // never landed). Any later reconcile removes the cloud row too.
    const cloudRows = [{ slot: 0, data: hero('A', 100) }, { slot: 1, data: hero('B', 200) }];
    const localRows = [{ slot: 1, data: hero('B', 200) }];
    const p = plan(cloudRows, localRows, { activeSlot: 1, deleted: ['A'] });
    expect(p.cloudDeletes).toContain(0);
    expect(p.uploads).not.toContain(0);
  });

  it('keeps a genuinely new local hero (never confuses a newcomer with a deletion)', () => {
    // A brand-new hero the cloud has never seen is NOT tombstoned → it must sync up.
    const cloudRows = [{ slot: 0, data: hero('B', 200) }];
    const localRows = [{ slot: 0, data: hero('B', 200) }, { slot: 1, data: hero('NEW', 300) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0, deleted: ['A'] });
    expect(p.uploads).toContain(1);                // NEW pushed up
    expect(p.localRemovals).not.toContain(1);      // NEW not scrubbed
  });
});

describe('planReconcile — last-write-wins for a shared hero', () => {
  it('adopts the cloud copy when it is newer', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 500, { level: 9 }) }];
    const localRows = [{ slot: 0, data: hero('A', 100, { level: 3 }) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    const w = p.localWrites.find(w => w.slot === 0);
    expect(w.data.player.level).toBe(9);           // newer cloud copy written locally
    expect(p.activeChanged).toBe(true);
    expect(p.uploads).not.toContain(0);            // nothing new to push
  });
  it('uploads the local copy when it is newer', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 100, { level: 3 }) }];
    const localRows = [{ slot: 0, data: hero('A', 500, { level: 9 }) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    expect(p.uploads).toContain(0);
    expect(p.localWrites.find(w => w.slot === 0)).toBeUndefined(); // local already newest
  });
  it('a tie keeps the cloud copy and writes/uploads nothing', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 300) }];
    const localRows = [{ slot: 0, data: hero('A', 300) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    expect(p.localWrites).toHaveLength(0);
    expect(p.uploads).toHaveLength(0);
    expect(p.activeChanged).toBe(false);
  });
});

describe('planReconcile — newcomers relocate instead of overwriting', () => {
  it('appends a colliding distinct hero to the lowest free slot and follows the active hero', () => {
    // Cloud has A in slot 0; this device independently has a DIFFERENT hero C in
    // slot 0. C must not overwrite A — it moves to slot 1 and the active slot follows.
    const cloudRows = [{ slot: 0, data: hero('A', 200) }];
    const localRows = [{ slot: 0, data: hero('C', 100) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    expect(p.newActiveSlot).toBe(1);
    expect(p.uploads).toContain(1);                       // C pushed to its new slot
    const w1 = p.localWrites.find(w => w.slot === 1);
    expect(w1.data.player.cid).toBe('C');
    // slot 0 gets A (cloud), and the old local C copy at slot 0 is overwritten by A.
    expect(p.localWrites.find(w => w.slot === 0).data.player.cid).toBe('A');
    expect(p.activeChanged).toBe(true);
  });

  it('two devices, two heroes each → account ends with all four', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 10) }, { slot: 1, data: hero('B', 10) }];
    const localRows = [{ slot: 0, data: hero('C', 20) }, { slot: 1, data: hero('D', 20) }];
    const p = plan(cloudRows, localRows, { activeSlot: 5 });
    // C and D relocate to the next free slots (2 and 3) and upload; A and B (unseen
    // by this device) are pulled down onto their cloud slots 0 and 1.
    expect(p.uploads.sort()).toEqual([2, 3]);
    const byCid = {};
    p.localWrites.forEach(w => { byCid[w.data.player.cid] = w.slot; });
    expect(byCid).toEqual({ A: 0, B: 1, C: 2, D: 3 });
  });
});

describe('planReconcile — legacy id-less saves', () => {
  it('treats an id-less local save colliding on a cloud slot as the same hero, adopting the cloud cid', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 100) }];
    const localRows = [{ slot: 0, data: hero(null, 500, { level: 7 }) }]; // legacy, newer
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    const w = p.localWrites.find(w => w.slot === 0);
    expect(w.data.player.level).toBe(7);           // newer legacy copy wins
    expect(w.data.player.cid).toBe('A');           // adopts the cloud's id (no dup)
    expect(p.uploads).toContain(0);
  });
  it('keeps the cloud copy when the legacy local save is older', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 900, { level: 9 }) }];
    const localRows = [{ slot: 0, data: hero(null, 100, { level: 2 }) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    const w = p.localWrites.find(w => w.slot === 0);
    expect(w.data.player.cid).toBe('A');
    expect(w.data.player.level).toBe(9);
  });
});

describe('planReconcile — hardcore-dead scrub (unchanged behavior)', () => {
  it('scrubs a dead hardcore hero from both sides', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 100, { hardcore: true }) }];
    const localRows = [{ slot: 0, data: hero('A', 100, { hardcore: true }) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0, dead: ['A'] });
    expect(p.cloudDeletes).toContain(0);
    expect(p.localRemovals).toContain(0);
    expect(p.uploads).not.toContain(0);
    expect(p.activeChanged).toBe(true);
  });
  it('keeps a newcomer off a just-freed dead slot (DELETE-after-PUSH guard)', () => {
    // Cloud slot 0 holds a dead hero we are deleting; a distinct local newcomer must
    // NOT be pushed to slot 0 (the in-flight DELETE could otherwise wipe it).
    const cloudRows = [{ slot: 0, data: hero('DEAD', 100, { hardcore: true }) }];
    const localRows = [{ slot: 3, data: hero('NEW', 200) }];
    const p = plan(cloudRows, localRows, { activeSlot: 3, dead: ['DEAD'] });
    expect(p.cloudDeletes).toContain(0);
    expect(p.newActiveSlot).toBe(1);               // NEW lands on 1, not the freed 0
    expect(p.uploads).toContain(1);
  });
});

describe('planReconcile — blanks and empties', () => {
  it('ignores blank/unstarted saves — never uploads or scrubs them', () => {
    // A blank title-screen slot must never be pushed to the cloud or counted; the
    // real hero it sits beside is left exactly as-is (already matches the cloud).
    const cloudRows = [{ slot: 0, data: hero('A', 100) }];
    const localRows = [{ slot: 0, data: hero('A', 100) }, { slot: 1, data: blank() }];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    expect(p.uploads).toHaveLength(0);       // blank not uploaded; hero already synced
    expect(p.localRemovals).toHaveLength(0); // blank slot left untouched
    expect(p.localWrites).toHaveLength(0);
  });
  it('handles empty inputs without error', () => {
    const p = plan([], [], { activeSlot: 0 });
    expect(p.cloudDeletes).toHaveLength(0);
    expect(p.localRemovals).toHaveLength(0);
    expect(p.localWrites).toHaveLength(0);
    expect(p.uploads).toHaveLength(0);
    expect(p.newActiveSlot).toBeNull();
    expect(p.activeChanged).toBe(false);
  });
  it('ignores malformed rows (bad slot)', () => {
    const cloudRows = [{ slot: 'x', data: hero('A', 1) }, null];
    const localRows = [{ slot: undefined, data: hero('B', 1) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    expect(p.uploads).toHaveLength(0);
    expect(p.localWrites).toHaveLength(0);
  });
  it('pulls a cloud-only hero down to this device', () => {
    const cloudRows = [{ slot: 2, data: hero('A', 100) }];
    const localRows = [];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    const w = p.localWrites.find(w => w.slot === 2);
    expect(w.data.player.cid).toBe('A');
    expect(p.uploads).not.toContain(2);            // already in the cloud
  });
});

describe('planReconcile — clock-skew-proof ordering (monotonic play-time)', () => {
  it('a more-PLAYED local copy wins even when its wall-clock ts is OLDER (skewed clock)', () => {
    // The clock-skew trap: the cloud copy carries a newer ts (a device whose clock
    // ran fast stamped it), but the local copy has strictly more play-time, so it is
    // genuinely the more-advanced save. Play-time ordering keeps it; ts alone would
    // have dropped it and lost real progress.
    const cloudRows = [{ slot: 0, data: hero('A', 9999, { playMs: 100, level: 3 }) }];
    const localRows = [{ slot: 0, data: hero('A', 1000, { playMs: 500, level: 9 }) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0, order: playOrder });
    expect(p.uploads).toContain(0);                             // more-played local pushed up
    expect(p.localWrites.find(w => w.slot === 0)).toBeUndefined(); // local already the winner
  });

  it('adopts the cloud copy when it has more play-time despite an older ts', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 1000, { playMs: 800, level: 12 }) }];
    const localRows = [{ slot: 0, data: hero('A', 9999, { playMs: 200, level: 4 }) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0, order: playOrder });
    const w = p.localWrites.find(w => w.slot === 0);
    expect(w.data.player.level).toBe(12);                       // more-played cloud adopted locally
    expect(p.uploads).not.toContain(0);
    expect(p.activeChanged).toBe(true);
  });

  it('breaks equal play-time ties by ts', () => {
    const cloudRows = [{ slot: 0, data: hero('A', 100, { playMs: 500, level: 5 }) }];
    const localRows = [{ slot: 0, data: hero('A', 200, { playMs: 500, level: 6 }) }];
    const p = plan(cloudRows, localRows, { activeSlot: 0, order: playOrder });
    expect(p.uploads).toContain(0);                             // newer ts wins the tie → local pushed
  });
});

describe('planReconcile — duplicate-cid cloud rows are de-duplicated', () => {
  it('keeps the more-advanced duplicate and DELETES the stale one', () => {
    // Two cloud rows carry the same hero (a leftover from an earlier bug/race). The
    // newer copy is kept at its slot; the stale duplicate row is deleted so the hero
    // can never appear twice on the account.
    const cloudRows = [
      { slot: 1, data: hero('A', 100, { level: 4 }) },
      { slot: 3, data: hero('A', 500, { level: 9 }) },
    ];
    const localRows = [];
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    expect(p.cloudDeletes).toContain(1);                        // stale duplicate row deleted
    expect(p.cloudDeletes).not.toContain(3);
    // The surviving row (slot 3, level 9) is pulled down; the deleted slot is not written.
    const w3 = p.localWrites.find(w => w.slot === 3);
    expect(w3.data.player.level).toBe(9);
    expect(p.localWrites.find(w => w.slot === 1)).toBeUndefined();
  });

  it('a local copy of a de-duplicated hero folds onto the surviving slot, not the deleted one', () => {
    const cloudRows = [
      { slot: 1, data: hero('A', 100, { level: 4 }) },   // stale duplicate → deleted
      { slot: 3, data: hero('A', 500, { level: 9 }) },   // survivor
    ];
    const localRows = [{ slot: 0, data: hero('A', 900, { level: 12 }) }]; // newest of all
    const p = plan(cloudRows, localRows, { activeSlot: 0 });
    expect(p.cloudDeletes).toContain(1);
    // Newest local (level 12) wins and lands on the survivor's slot 3; slot 0's stale
    // local copy is cleared (the hero moved).
    const w3 = p.localWrites.find(w => w.slot === 3);
    expect(w3.data.player.level).toBe(12);
    expect(p.uploads).toContain(3);
    expect(p.localRemovals).toContain(0);
  });

  it('does not treat two distinct legacy (id-less) rows as duplicates', () => {
    // Legacy id-less saves key on their slot index, so different slots are different
    // heroes — they must never be de-duplicated into one.
    const cloudRows = [
      { slot: 0, data: hero(null, 100, { level: 3 }) },
      { slot: 1, data: hero(null, 100, { level: 7 }) },
    ];
    const localRows = [];
    const p = plan(cloudRows, localRows, { activeSlot: 9 });
    expect(p.cloudDeletes).toHaveLength(0);                     // both kept
  });
});

// ═══════════════════════ per-slot push guard ═════════════════════════════════
// planSlotPush is the read-before-write gate that stops a stale tab from clobbering
// a newer cloud save. Verdicts: 'write' (mirror up), 'skip' (nothing to do), 'pull'
// (cloud is ahead — reconcile instead of overwriting).

describe('planSlotPush', () => {
  const push = (local, cloud) => planSlotPush({ local, cloud, isStarted, cidOf, saveOrder: playOrder });

  it("skips a blank / not-yet-started local hero (never overwrites a real cloud save)", () => {
    expect(push(blank(), hero('A', 500, { playMs: 100 }))).toBe('skip');
    expect(push(null, hero('A', 500))).toBe('skip');
    expect(push(undefined, null)).toBe('skip');
  });

  it("writes when the cloud slot is empty or holds only a blank", () => {
    expect(push(hero('A', 500, { playMs: 100 }), null)).toBe('write');
    expect(push(hero('A', 500, { playMs: 100 }), undefined)).toBe('write');
    expect(push(hero('A', 500, { playMs: 100 }), blank())).toBe('write');
  });

  it("writes when it is the SAME hero and our copy is strictly newer (more play-time)", () => {
    const local = hero('A', 900, { playMs: 200 });
    const cloud = hero('A', 500, { playMs: 100 });
    expect(push(local, cloud)).toBe('write');
  });

  it("PULLS (never clobbers) when the SAME hero is newer in the cloud", () => {
    // The reported bug: this tab is stale, the cloud copy was advanced on another
    // device. The stale push must defer, not overwrite.
    const local = hero('A', 500, { playMs: 100 });
    const cloud = hero('A', 900, { playMs: 300 });
    expect(push(local, cloud)).toBe('pull');
  });

  it("skips when the two copies are the same version (no needless write)", () => {
    const local = hero('A', 500, { playMs: 100 });
    const cloud = hero('A', 500, { playMs: 100 });
    expect(push(local, cloud)).toBe('skip');
  });

  it("PULLS when a DIFFERENT character occupies the slot on the account", () => {
    // Another device relocated heroes; our slot now holds someone else's cloud hero.
    // Blind-overwriting would nuke that innocent hero — defer to a reconcile.
    const local = hero('A', 900, { playMs: 500 });
    const cloud = hero('B', 100, { playMs: 10 });
    expect(push(local, cloud)).toBe('pull');
  });

  it("clock-skew proof: a stale copy with a FUTURE ts still can't win on play-time", () => {
    // Local has a wildly-future wall-clock ts but LESS play-time than the cloud copy —
    // play-time is monotonic, so the cloud (more-played) copy must win.
    const local = hero('A', 9e15, { playMs: 100 });   // skewed clock, future ts
    const cloud = hero('A', 500, { playMs: 400 });      // genuinely more played
    expect(push(local, cloud)).toBe('pull');
  });

  it("ts only breaks ties at EQUAL play-time", () => {
    const newer = hero('A', 800, { playMs: 100 });
    const older = hero('A', 500, { playMs: 100 });
    expect(push(newer, older)).toBe('write');
    expect(push(older, newer)).toBe('pull');
  });

  it("legacy id-less copies fall through to the order (not treated as different heroes)", () => {
    // One side has a cid, the other is a pre-id legacy save of the same hero carried
    // forward — the `different cid` guard must NOT fire, so the order decides.
    expect(push(hero(null, 900, { playMs: 200 }), hero('A', 500, { playMs: 100 }))).toBe('write');
    expect(push(hero('A', 900, { playMs: 200 }), hero(null, 500, { playMs: 100 }))).toBe('write');
    // Both id-less: still ordered normally.
    expect(push(hero(null, 500, { playMs: 100 }), hero(null, 900, { playMs: 300 }))).toBe('pull');
  });
});
