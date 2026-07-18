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

// ── Account-wide meta ledger (hardcore death ledger + earned feat sets) ──────
// The hardcore-meta row (HC_CLOUD_SLOT in the shell) carries THREE union-merged
// sets that only ever GROW: `cids` (hardcore-dead character ids), `ach` (feats
// earned in Hardcore), and `nach` (feats earned in normal/Kitten play). All three
// are account-wide and synced identically — monotonic, so a stale device can never
// shrink them. The feat sets live HERE, not in a per-slot save, precisely so
// achievements are ACCOUNT-WIDE: earned on any hero or slot, they light up on every
// hero and slot and survive that hero's death or a slot deletion. The set algebra is
// pure and unit-tested here; the shell owns the storage + cloud plumbing.

/** A blank meta ledger: no deaths, no feats, never written. */
export function freshHcMeta() { return { cids: [], ach: [], nach: [], ts: 0 }; }

/** Coerce an arbitrary parsed blob into a clean { cids, ach, nach, ts } ledger. */
export function sanitizeHcMeta(d) {
  const out = freshHcMeta();
  if (d && typeof d === 'object') {
    const strs = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string') : []);
    out.cids = strs(d.cids);
    out.ach = strs(d.ach);
    out.nach = strs(d.nach);
    out.ts = Math.max(0, Math.floor(d.ts) || 0);
  }
  return out;
}

/**
 * Union a cloud meta ledger into the local one — monotonic across all three sets
 * (entries only ever added, never removed). Returns { meta, grew, learnedDeath }:
 *   meta         — the merged, de-duplicated ledger (a NEW object; inputs untouched).
 *   grew         — any of cids/ach/nach gained a new entry (caller persists on true).
 *   learnedDeath — a DEATH cid arrived that this device didn't already hold, so a
 *                  hero still "live" on this device may need locking out.
 * Never shrinks, so a device holding a stale/smaller ledger can't erase a death or
 * feat recorded elsewhere. When nothing new arrives the timestamp is the max of the
 * two, so a reconcile is idempotent.
 */
export function mergeHcMeta(local, cloud, now) {
  const base = sanitizeHcMeta(local);
  const incoming = sanitizeHcMeta(cloud);
  const baseCids = new Set(base.cids), baseAch = new Set(base.ach), baseNach = new Set(base.nach);
  const cidSet = new Set(baseCids), achSet = new Set(baseAch), nachSet = new Set(baseNach);
  incoming.cids.forEach(x => cidSet.add(x));
  incoming.ach.forEach(x => achSet.add(x));
  incoming.nach.forEach(x => nachSet.add(x));
  const grew = cidSet.size !== baseCids.size || achSet.size !== baseAch.size || nachSet.size !== baseNach.size;
  return {
    meta: {
      cids: Array.from(cidSet), ach: Array.from(achSet), nach: Array.from(nachSet),
      ts: grew ? now : Math.max(base.ts, incoming.ts),
    },
    grew,
    learnedDeath: cidSet.size > baseCids.size,
  };
}

/** True when the cloud ledger already holds every cid/feat we do (skip a pointless write). */
export function hcMetaCloudHasAll(local, cloud) {
  const base = sanitizeHcMeta(local);
  const c = sanitizeHcMeta(cloud);
  const cc = new Set(c.cids), ca = new Set(c.ach), cn = new Set(c.nach);
  return base.cids.every(x => cc.has(x)) && base.ach.every(x => ca.has(x)) && base.nach.every(x => cn.has(x));
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
 *   saveOrder   (a, b) => number   comparator deciding which of two copies of the
 *                                  SAME hero is newer (>0 → a newer, <0 → b newer,
 *                                  0 → same version). Defaults to wall-clock `ts`,
 *                                  but the game injects a clock-skew-PROOF order:
 *                                  monotonic play-time first, `ts` only as a
 *                                  tiebreak — so a stale copy carrying a skewed
 *                                  future `ts` can never overwrite a more-played one.
 *
 * Returns a plan:
 *   cloudDeletes  number[]         cloud slots to DELETE (dead/tombstoned rows, or a stale duplicate).
 *   localRemovals number[]         local slots to clear (scrubbed, or vacated by a move).
 *   localWrites   [{ slot, data }] local slots to (over)write with the chosen save.
 *   uploads       number[]         slots whose chosen save must be pushed to the cloud.
 *   newActiveSlot number|null      the slot to point ACTIVE_SLOT at, if it moved.
 *   activeChanged boolean          the active slot's contents changed (caller reloads).
 *
 * Invariants that keep saves safe:
 *   • A save is only ever removed/deleted if it is DEAD or TOMBSTONED, a stale
 *     DUPLICATE of a hero also present in a newer row, or the SAME hero moved to
 *     another slot — never merely because the cloud hasn't seen it. An unknown
 *     local hero is a NEWCOMER, appended to a free slot and pushed up.
 *   • Cloud characters keep their slot; `saveOrder` decides which copy of a shared
 *     hero survives. Ties keep the cloud copy (no needless write).
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
  saveOrder = (a, b) => (((a && a.ts) || 0) - ((b && b.ts) || 0)),
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

  // 1) Anchor every cloud character at its cloud slot. If two cloud rows somehow
  //    share an identity (a duplicate left by an earlier bug/race), keep the newer
  //    and DELETE the stale one — a hero must never exist twice on the account.
  //    (A legacy id-less save keys on its slot index, so distinct legacy rows never
  //    collide; only cid-bearing rows can, and only for the same character.)
  const assign = {};
  const cloudIds = {};        // identity key -> winning cloud slot
  for (const s of Object.keys(cloud).map(Number)) {
    if (!cloud[s]) continue;  // a duplicate already resolved below
    const key = idOf(cloud[s], s);
    const prev = cloudIds[key];
    if (prev === undefined) {
      cloudIds[key] = s;
      assign[s] = cloud[s];
    } else {
      const keep = saveOrder(cloud[s], cloud[prev]) > 0 ? s : prev;
      const drop = keep === prev ? s : prev;
      cloudIds[key] = keep;
      assign[keep] = cloud[keep];
      delete assign[drop];
      plan.cloudDeletes.push(drop);
      reserved.add(drop);
      cloud[drop] = undefined; // hide the loser from downstream slot lookups
    }
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
      if (saveOrder(l, assign[cs]) > 0) assign[cs] = l;
    } else if (!cidOf(l) && cloud[i]) {
      localDest[i] = i;
      if (saveOrder(l, cloud[i]) > 0) {
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
  const sameSave = (a, b) => !!a && !!b && saveOrder(a, b) === 0 && cidOf(a) === cidOf(b);
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

// ── Per-slot push guard ──────────────────────────────────────────────────────
// Decide whether this device may safely mirror its local per-slot save OVER the
// account's CURRENT cloud row for that slot. PURE: the caller passes the parsed
// local save and the already-fetched cloud row and acts on the verdict, so every
// side effect (fetch/localStorage) stays at the edge.
//
// This is the integrity backstop that makes a blind last-writer-wins upload
// impossible. Before this, a debounced/periodic push blind-upserted the cloud row,
// so a STALE tab — one left open while the same hero was advanced on another device —
// would clobber the newer cloud save purely by writing last. Reading the cloud FIRST
// and deferring to it when it is ahead closes that hole; the pushing device can only
// ever move a hero FORWARD, never backward.
//
// Verdict:
//   'write' — safe to upsert: the cloud has nothing real in this slot, or it holds
//             the SAME hero and our copy is strictly newer (by the injected order).
//   'skip'  — nothing to do: our copy is blank/unstarted, or the same version the
//             cloud already holds (no needless write).
//   'pull'  — DO NOT write: the cloud holds a NEWER copy of this hero, or a DIFFERENT
//             live hero at this slot. Our copy is stale — the caller must reconcile
//             (adopt the newer copy / relocate) instead of overwriting.
//
// `saveOrder` is the SAME clock-skew-proof comparator planReconcile uses (monotonic
// play-time first, wall-clock ts only as a tiebreak), so the push path and the merge
// path agree on which copy of a hero is newer.
export function planSlotPush({ local, cloud, isStarted, cidOf, saveOrder }) {
  if (!local || !isStarted(local)) return 'skip';    // never push a not-yet-begun hero
  if (!cloud || !isStarted(cloud)) return 'write';   // the cloud slot is empty/blank — claim it
  const lid = cidOf(local);
  const cid = cidOf(cloud);
  if (lid && cid && lid !== cid) return 'pull';      // a DIFFERENT character sits at this slot on the account
  const ord = saveOrder(local, cloud);
  if (ord > 0) return 'write';                        // ours is strictly newer — mirror it up
  if (ord < 0) return 'pull';                         // the cloud copy is newer — adopt it, don't clobber
  return 'skip';                                      // identical version — leave the cloud as-is
}
