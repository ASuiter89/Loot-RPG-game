import { describe, it, expect } from 'vitest';
import {
  freshDelMeta,
  sanitizeDelMeta,
  isTombstoned,
  addTombstone,
  mergeDelMeta,
  delCloudHasAll,
  planReconcile,
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
