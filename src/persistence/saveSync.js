// Cross-device save-sync logic — the pure core behind the cloud reconcile.
//
// The legacy shell owns the side effects (Supabase `fetch`, `localStorage`); this
// module owns the DECISIONS: given the account's cloud rows, this device's local
// slots, and the deletion-tombstone ledger, it computes a plan of exactly what to
// write, remove, upload and delete so every device converges on the same layout.
// Keeping the merge pure makes the tricky part deterministic and unit-testable
// (no test performs real I/O), and it is the single place the resurrection bug is
// fixed: a deleted hero is scrubbed from BOTH sides instead of being mistaken for
// a brand-new character and pushed back up.
//
// The deletion ledger is modeled on the existing hardcore death ledger: an
// append-only, union-merged set of character ids (cids) that only ever GROWS, so a
// delete recorded on any device can never be undone by an older copy on another —
// the moment either device syncs, the tombstone propagates and the hero stays gone
// everywhere. Fail-open by construction: a cid is only ever added at a genuine
// user-initiated delete site, so the scrub can never remove a save the player
// still wants.

// ── Deletion-tombstone ledger (a union-merged set of deleted cids) ───────────

/** A blank ledger: no tombstones, never written. */
export function freshDelMeta() { return { cids: [], ts: 0 }; }

/** Coerce an arbitrary parsed blob into a clean { cids:[string], ts } ledger. */
export function sanitizeDelMeta(d) {
  const out = freshDelMeta();
  if (d && typeof d === 'object') {
    out.cids = Array.isArray(d.cids) ? d.cids.filter(x => typeof x === 'string') : [];
    out.ts = Math.max(0, Math.floor(d.ts) || 0);
  }
  return out;
}

/** Membership test — is this cid tombstoned? A falsy cid is never tombstoned. */
export function isTombstoned(meta, cid) {
  if (!cid) return false;
  return sanitizeDelMeta(meta).cids.indexOf(cid) !== -1;
}

/**
 * Append a cid to a ledger. Append-only and idempotent: re-deleting an already
 * tombstoned hero is a harmless no-op. Returns { meta, added } — a NEW ledger
 * object (the input is never mutated) and whether it actually grew.
 */
export function addTombstone(meta, cid, now) {
  const base = sanitizeDelMeta(meta);
  if (!cid || base.cids.indexOf(cid) !== -1) return { meta: base, added: false };
  return { meta: { cids: base.cids.concat(cid), ts: now }, added: true };
}

/**
 * Union a cloud ledger into the local one — monotonic, cids only ever added.
 * Returns { meta, grew }: the merged ledger and whether it gained any new cid.
 * Never shrinks, so a device holding a stale/smaller ledger can't erase a
 * tombstone recorded elsewhere. When nothing new arrives the timestamp is the
 * max of the two so a reconcile is idempotent.
 */
export function mergeDelMeta(local, cloud, now) {
  const base = sanitizeDelMeta(local);
  const incoming = sanitizeDelMeta(cloud);
  const set = new Set(base.cids);
  const before = set.size;
  incoming.cids.forEach(c => set.add(c));
  const grew = set.size !== before;
  return {
    meta: { cids: Array.from(set), ts: grew ? now : Math.max(base.ts, incoming.ts) },
    grew,
  };
}

/** True when the cloud ledger already holds every cid we do (skip a pointless write). */
export function delCloudHasAll(local, cloud) {
  const cloudSet = new Set(sanitizeDelMeta(cloud).cids);
  return sanitizeDelMeta(local).cids.every(c => cloudSet.has(c));
}

// ── The reconcile planner ────────────────────────────────────────────────────

/**
 * Plan the per-slot merge of this device's local saves with the account's cloud
 * rows. PURE: it reads nothing and writes nothing — the caller passes already-
 * fetched cloud rows and already-read local rows, and applies the returned plan.
 *
 * Inputs:
 *   cloudRows   [{ slot:number, data }]  rows fetched from the account.
 *   localRows   [{ slot:number, data }]  parsed saves this device holds locally.
 *   activeSlot  number   the slot currently being played (to follow if it moves).
 *   isStarted   (data) => boolean   a real, begun hero (blanks are ignored).
 *   cidOf       (data) => string|null   the hero's stable id, or null (legacy).
 *   isDead      (data) => boolean   a hardcore hero already in the death ledger.
 *   isDeleted   (data) => boolean   a hero whose cid is in the deletion ledger.
 *   lowestFree  (usedSet) => number   lowest slot index not in the Set.
 *
 * Returns a plan:
 *   cloudDeletes  number[]         cloud slots to DELETE (dead or tombstoned rows).
 *   localRemovals number[]         local slots to clear (scrubbed, or vacated by a move).
 *   localWrites   [{ slot, data }] local slots to (over)write with the chosen save.
 *   uploads       number[]         slots whose chosen save must be pushed to the cloud.
 *   newActiveSlot number|null      the slot to point ACTIVE_SLOT at, if it moved.
 *   activeChanged boolean          the active slot's contents changed (caller reloads).
 *
 * Invariants that keep saves safe:
 *   • A save is only ever removed/deleted if it is DEAD or TOMBSTONED, or if the
 *     SAME hero (same identity) was moved to another slot — never merely because
 *     the cloud hasn't seen it. An unknown local hero is a NEWCOMER, appended to a
 *     free slot and pushed up, exactly as before.
 *   • Cloud characters keep their slot; last-write-wins by `ts` decides which copy
 *     of a shared hero survives. Ties keep the cloud copy (no needless write).
 */
export function planReconcile({
  cloudRows,
  localRows,
  activeSlot,
  isStarted,
  cidOf,
  isDead,
  isDeleted,
  lowestFree,
}) {
  const plan = {
    cloudDeletes: [],
    localRemovals: [],
    localWrites: [],
    uploads: [],
    newActiveSlot: null,
    activeChanged: false,
  };

  // Started saves on each side, keyed by slot. Dead (hardcore-permadeath) and
  // deleted (user-tombstoned) heroes are scrubbed from BOTH sides up front and can
  // never re-enter the layout — the ledgers are the source of truth on who is gone.
  const cloud = {};
  const local = {};
  const reserved = new Set(); // freed-but-being-deleted cloud slots — keep newcomers off them

  (cloudRows || []).forEach(r => {
    if (!r || typeof r.slot !== 'number') return;
    if (isDead(r.data) || isDeleted(r.data)) {
      plan.cloudDeletes.push(r.slot);
      reserved.add(r.slot);
      return;
    }
    if (isStarted(r.data)) cloud[r.slot] = r.data;
  });

  const localSlots = [];
  (localRows || []).forEach(r => {
    if (!r || typeof r.slot !== 'number') return;
    localSlots.push(r.slot);
    if (isDead(r.data) || isDeleted(r.data)) {
      plan.localRemovals.push(r.slot);
      if (r.slot === activeSlot) plan.activeChanged = true;
      return;
    }
    if (isStarted(r.data)) local[r.slot] = r.data;
  });
  localSlots.sort((a, b) => a - b);

  const idOf = (d, slot) => (cidOf(d) ? 'cid:' + cidOf(d) : 'slot:' + slot);

  // 1) Anchor every cloud character at its cloud slot.
  const assign = {};
  const cloudIds = {};
  for (const s of Object.keys(cloud).map(Number)) {
    assign[s] = cloud[s];
    cloudIds[idOf(cloud[s], s)] = s;
  }

  // 2) Fold in each local character. Same id as a cloud char → keep the newer copy
  //    at the cloud's slot. A legacy (id-less) local save colliding on a cloud
  //    slot is the same hero carried forward. Anything else is new to the account
  //    and gets appended to the lowest free slot.
  const used = new Set(Object.keys(assign).map(Number));
  reserved.forEach(s => used.add(s));
  const localDest = {};
  const newcomers = [];
  for (const i of localSlots) {
    const l = local[i];
    if (!l) continue;
    const key = idOf(l, i);
    if (key in cloudIds) {
      const cs = cloudIds[key];
      localDest[i] = cs;
      if ((l.ts || 0) > (assign[cs].ts || 0)) assign[cs] = l;
    } else if (!cidOf(l) && cloud[i]) {
      localDest[i] = i;
      if ((l.ts || 0) > (cloud[i].ts || 0)) {
        // The newer legacy copy wins, but carry the cloud's id onto it so the hero
        // keeps a stable identity and is never duplicated. Clone rather than mutate
        // in place: the untouched `l` stays the on-disk (id-less) baseline, so the
        // apply step below sees a difference and actually persists + uploads the
        // now-id-bearing save (a bare mutation would look identical and never land).
        assign[i] = (cidOf(cloud[i]) && l.player)
          ? { ...l, player: { ...l.player, cid: cidOf(cloud[i]) } }
          : l;
      }
    } else {
      newcomers.push(i);
    }
  }
  for (const i of newcomers) {
    const slot = lowestFree(used);
    used.add(slot);
    assign[slot] = local[i];
    localDest[i] = slot;
  }

  // 3) Emit the plan. Cloud characters never move, so no cloud row is deleted here
  //    (only the scrubbed dead/tombstoned rows above are). Clear stale local copies
  //    left behind by a moved hero, then write/upload wherever a copy differs.
  const sameSave = (a, b) => !!a && !!b && (a.ts || 0) === (b.ts || 0) && cidOf(a) === cidOf(b);
  const assignedSlots = new Set(Object.keys(assign).map(Number));
  for (const i of localSlots) {
    if (local[i] && !assignedSlots.has(i)) {
      plan.localRemovals.push(i);
      if (i === activeSlot) plan.activeChanged = true;
    }
  }
  for (const i of assignedSlots) {
    const occ = assign[i];
    if (!sameSave(local[i], occ)) {
      plan.localWrites.push({ slot: i, data: occ });
      if (i === activeSlot) plan.activeChanged = true;
    }
    if (!sameSave(cloud[i], occ)) plan.uploads.push(i);
  }
  if (localDest[activeSlot] != null && localDest[activeSlot] !== activeSlot) {
    plan.newActiveSlot = localDest[activeSlot];
    plan.activeChanged = true;
  }

  return plan;
}
