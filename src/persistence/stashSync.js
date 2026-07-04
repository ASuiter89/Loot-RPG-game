// Conflict-free cross-device merge for the shared stash (the account-wide Vault).
//
// The per-character saves reconcile per hero, but the stash is ONE shared pool, so
// last-writer-wins on the whole blob loses data when two devices edit it while
// offline (deposit on A, deposit on B → the later push wins and the other deposit
// is gone). This module makes the stash a small CRDT so any two copies merge with
// NO loss regardless of order or concurrency:
//
//   • Gold is a PN-counter: per-device running totals of deposits and withdrawals.
//     The merge takes the per-device MAX of each, then gold = Σdeposits − Σwithdrawals
//     (clamped ≥ 0). Two devices' independent deposits both survive; a device can't
//     lower another's counter.
//   • Items are an OR-set keyed by a per-DEPOSIT tag (`_st`): a deposit adds a fresh
//     tag, a withdrawal tombstones that tag. The merge is (union of items by tag)
//     minus (union of withdrawal tombstones), so a deposit on one device and a
//     withdrawal on another both take effect, and a withdrawn item is never
//     resurrected. Re-depositing a withdrawn item mints a NEW tag, so it survives.
//
// PURE + deterministic (no I/O, no clock, no RNG): the legacy shell mints tags/device
// ids and owns fetch/localStorage; this module owns the structure and the merge, so
// the tricky part is unit-tested. Merge is commutative, associative and idempotent.

export const STASH_VERSION = 2;
// v1 gold is attributed to this SHARED key so a cross-device merge takes its MAX
// (never double-counts the same pre-existing balance). New activity uses real
// per-device keys and sums correctly.
export const LEGACY_GOLD_KEY = '_legacy';
// Cap on retained withdrawal tombstones, so the blob can't grow without bound. Far
// above any realistic offline-withdrawal streak, so pruning never resurrects a live
// item in practice.
export const RM_CAP = 5000;

/** A blank v2 stash. */
export function freshStash() {
  return { v: STASH_VERSION, gold: 0, items: [], ts: 0, gl: { dep: {}, wd: {} }, rm: [] };
}

// Keep only positive-integer counter entries.
function cleanCounter(o) {
  const out = {};
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      const v = Math.max(0, Math.floor(Number(o[k])) || 0);
      if (v > 0) out[k] = v;
    }
  }
  return out;
}

// Per-key MAX of two counters (the CRDT join for a grow-only counter).
function mergeCounter(x, y) {
  const out = cleanCounter(x);
  const yc = cleanCounter(y);
  for (const k of Object.keys(yc)) out[k] = Math.max(out[k] || 0, yc[k]);
  return out;
}

/** Gold on hand = Σdeposits − Σwithdrawals, clamped ≥ 0. */
export function goldValue(gl) {
  const sum = o => Object.keys(o || {}).reduce((a, k) => a + (Number(o[k]) || 0), 0);
  return Math.max(0, Math.floor(sum(gl && gl.dep) - sum(gl && gl.wd)));
}

// A stable, deterministic tag for a pre-CRDT (v1) item, derived from its own stable
// id so the SAME item migrated on two devices gets the SAME tag (and dedups) instead
// of duplicating. Falls back to a structural key if an item somehow lacks an id.
function legacyTag(it) {
  if (it && it.id != null) return 'L' + it.id;
  try { return 'L' + JSON.stringify({ n: it && it.name, s: it && it.slot, i: it && it.ilvl }); }
  catch (e) { return 'L?'; }
}

/**
 * Coerce any parsed blob into a clean v2 stash, migrating a v1 `{ gold, items, ts }`
 * blob in the process. Idempotent: re-sanitizing a v2 blob returns an equivalent v2
 * blob (tags and counters are preserved). Never throws.
 */
export function sanitizeStash(d) {
  const src = (d && typeof d === 'object') ? d : {};
  const hasLedger = !!(src.gl && typeof src.gl === 'object');
  const dep = hasLedger ? cleanCounter(src.gl.dep) : {};
  const wd = hasLedger ? cleanCounter(src.gl.wd) : {};
  const rm = Array.isArray(src.rm)
    ? src.rm.filter(t => typeof t === 'string' || typeof t === 'number').map(String)
    : [];
  const ts = Math.max(0, Math.floor(src.ts) || 0);

  if (!hasLedger) {
    // v1 → v2: fold the flat gold into the shared legacy key (MAX-merged, so two
    // devices' pre-existing balances don't sum).
    const flat = Math.max(0, Math.floor(src.gold) || 0);
    if (flat > 0) dep[LEGACY_GOLD_KEY] = Math.max(dep[LEGACY_GOLD_KEY] || 0, flat);
  }

  // Every stashed item must carry a tag; migrate id-less v1 items to a deterministic
  // legacy tag. Filter to real items (they carry a gear `slot`).
  const rmSet = new Set(rm);
  const seen = new Set();
  const items = [];
  (Array.isArray(src.items) ? src.items : []).forEach(it => {
    if (!it || !it.slot) return;
    const tagged = (it._st != null) ? it : Object.assign({}, it, { _st: legacyTag(it) });
    const tag = String(tagged._st);
    if (rmSet.has(tag) || seen.has(tag)) return; // withdrawn or duplicate → drop
    seen.add(tag);
    items.push(tagged);
  });

  const gl = { dep, wd };
  return { v: STASH_VERSION, gl, rm: Array.from(rmSet), items, gold: goldValue(gl), ts };
}

/**
 * Conflict-free merge of two stash blobs (either version). The result loses nothing
 * from either side: gold counters take the per-device max, items are unioned by tag
 * minus the union of withdrawal tombstones. Commutative / associative / idempotent.
 * `opts.rmCap` bounds retained tombstones.
 */
export function mergeStash(a, b, opts = {}) {
  const rmCap = opts.rmCap || RM_CAP;
  const A = sanitizeStash(a);
  const B = sanitizeStash(b);

  const gl = { dep: mergeCounter(A.gl.dep, B.gl.dep), wd: mergeCounter(A.gl.wd, B.gl.wd) };

  // Union of withdrawal tombstones.
  const rmSet = new Set(A.rm);
  B.rm.forEach(t => rmSet.add(String(t)));

  // Union of items by tag, excluding anything tombstoned.
  const byTag = new Map();
  const take = items => items.forEach(it => {
    const tag = it && it._st != null ? String(it._st) : null;
    if (tag == null || rmSet.has(tag) || byTag.has(tag)) return;
    byTag.set(tag, it);
  });
  take(A.items);
  take(B.items);

  // Bound tombstone growth. Keep any tag still referenced by a surviving item, then
  // fill up to the cap with the rest — so pruning can never resurrect a live item.
  let rm = Array.from(rmSet).map(String);
  if (rm.length > rmCap) {
    const live = new Set(Array.from(byTag.keys()));
    const referenced = rm.filter(t => live.has(t)); // (normally none — tombstoned tags aren't live)
    const rest = rm.filter(t => !live.has(t));
    rm = referenced.concat(rest).slice(0, rmCap);
  }

  return {
    v: STASH_VERSION,
    gl,
    rm,
    items: Array.from(byTag.values()),
    gold: goldValue(gl),
    ts: Math.max(A.ts || 0, B.ts || 0),
  };
}

/** Record a gold DEPOSIT by a device (mutates + re-materializes gold). Returns the stash. */
export function depositGold(stash, deviceId, amount) {
  const n = Math.max(0, Math.floor(amount) || 0);
  if (n > 0) {
    stash.gl.dep[deviceId] = (stash.gl.dep[deviceId] || 0) + n;
    stash.gold = goldValue(stash.gl);
  }
  return stash;
}

/** Record a gold WITHDRAWAL by a device (mutates + re-materializes gold). Returns the stash. */
export function withdrawGold(stash, deviceId, amount) {
  const n = Math.max(0, Math.floor(amount) || 0);
  if (n > 0) {
    stash.gl.wd[deviceId] = (stash.gl.wd[deviceId] || 0) + n;
    stash.gold = goldValue(stash.gl);
  }
  return stash;
}
