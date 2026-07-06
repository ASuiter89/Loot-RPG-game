// THE HALL OF DEEDS — pure evaluation core. Deterministic functions over a plain,
// read-only account SNAPSHOT (assembled by the shell); no globals, no DOM, no RNG,
// no clock. The legacy shell owns the live systems, builds the snapshot once when the
// Hall opens, persists the set of completed deed ids (player.deeds.completed) and the
// lifetime renown total, and renders. This module only answers "which deeds are done,
// how much renown is that, and which just crossed."
//
// See data/deeds.js for the full snapshot contract. Every deed is a generic
// {requirement:{kind, threshold}}; `kind` names one number in the snapshot via the
// reader map below, so there is NO per-deed predicate code to keep in sync.
import { DEEDS } from '../data/deeds.js';

// ── The snapshot reader map ── the ONE place a requirement `kind` is bound to a
// snapshot path. Each reader is defensive: a missing branch, a non-array, or a
// non-object yields undefined, which snapshotValue() then coerces to 0. Adding a new
// deed axis is a single line here plus the data entry — nothing else changes.
const KIND_READERS = {
  collectionHave:     (s) => s && s.collection && s.collection.have,
  bestiaryDiscovered: (s) => s && s.bestiary && s.bestiary.discovered,
  diffCleared:        (s) => s && s.diffCleared,
  maxFloor:           (s) => s && s.maxFloor,
  endlessFloor:       (s) => s && s.endlessFloor,
  bountyTotal:        (s) => s && s.bounties && s.bounties.total,
  // Breadth measures the COUNT of distinct classes, not the array itself.
  classesPlayed:      (s) => (s && Array.isArray(s.classesPlayed)) ? s.classesPlayed.length : 0,
  setsCompleted:      (s) => s && s.setsCompleted,
  mirrored:           (s) => s && s.mirrored,
};

// The live value a requirement kind reads from the snapshot, coerced to a clean
// non-negative number. Unknown kind or garbage input ⇒ 0, so a bad deed can never
// throw or read as "satisfied by accident."
export function snapshotValue(snapshot, kind) {
  const reader = KIND_READERS[kind];
  if (!reader) return 0;
  const raw = reader(snapshot);
  const n = Number(raw);
  return (isFinite(n) && n > 0) ? n : 0;
}

// The (floored, non-negative) bar a deed must clear. Garbage threshold ⇒ 0.
function deedThreshold(deed) {
  const t = deed && deed.requirement ? Number(deed.requirement.threshold) : 0;
  return (isFinite(t) && t > 0) ? Math.floor(t) : 0;
}

// Is this deed complete under the given snapshot? Generic: read the requirement's
// number, compare to its threshold. A deed with no/garbage requirement is never
// satisfied (threshold 0 with value 0 would tie, so we require a real positive bar).
export function deedSatisfied(deed, snapshot) {
  if (!deed || !deed.requirement) return false;
  const need = deedThreshold(deed);
  if (need <= 0) return false;
  return snapshotValue(snapshot, deed.requirement.kind) >= need;
}

// Progress toward a single deed, for the meter under its tile: how far along, the
// bar, and a clamped 0..1 fraction (1 when done, 0 for a degenerate bar). `have` is
// capped at `need` so an over-shot counter still reads as a full — not >100% — bar.
export function deedProgress(deed, snapshot) {
  const need = deedThreshold(deed);
  const rawHave = deed && deed.requirement ? snapshotValue(snapshot, deed.requirement.kind) : 0;
  const have = need > 0 ? Math.min(rawHave, need) : 0;
  const pct = need > 0 ? Math.max(0, Math.min(1, rawHave / need)) : (rawHave > 0 ? 1 : 0);
  return { have, need, pct };
}

// Evaluate the WHOLE catalog against a snapshot. Returns the ids currently complete,
// the summed renown they are worth (the lifetime renown total that feeds the renown
// track), and which ids are NEWLY complete vs a previously-persisted set — the shell
// uses `newlyCompleted` to fire the one-shot "Deed earned!" banner and to avoid
// re-announcing. `prevCompletedIds` may be an array or a Set (or missing on a fresh
// account). Renown of an unknown/garbage renown value counts as 0.
export function evaluateDeeds(snapshot, prevCompletedIds, data = DEEDS) {
  const list = Array.isArray(data) ? data : [];
  const prev = (prevCompletedIds instanceof Set)
    ? prevCompletedIds
    : new Set(Array.isArray(prevCompletedIds) ? prevCompletedIds : []);
  const completedIds = [];
  const newlyCompleted = [];
  let totalRenown = 0;
  for (const deed of list) {
    if (!deed || !deedSatisfied(deed, snapshot)) continue;
    completedIds.push(deed.id);
    const r = Number(deed.renown);
    if (isFinite(r) && r > 0) totalRenown += r;
    if (!prev.has(deed.id)) newlyCompleted.push(deed.id);
  }
  return { completedIds, totalRenown, newlyCompleted };
}

// Group the catalog by `category` in first-seen order, for the sectioned Hall view.
// Returns an ordered array of { category, deeds:[…] } so the UI renders sections in a
// stable sequence (collection, bestiary, conquest, depth, bounty, breadth, mastery)
// without hardcoding the list — new categories in the data appear automatically.
export function deedsByCategory(data = DEEDS) {
  const list = Array.isArray(data) ? data : [];
  const order = [];
  const byCat = new Map();
  for (const deed of list) {
    if (!deed) continue;
    const cat = deed.category || 'other';
    if (!byCat.has(cat)) { byCat.set(cat, []); order.push(cat); }
    byCat.get(cat).push(deed);
  }
  return order.map((category) => ({ category, deeds: byCat.get(category) }));
}
