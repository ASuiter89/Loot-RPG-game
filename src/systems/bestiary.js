// Pure reveal logic for the BESTIARY — the per-species kill ledger that gates how
// much of a foe's stat block you can read, both on the live hover inspect card and
// in the Bestiary codex. Deterministic and DOM-free: the kill count, a stable
// string-hash and the reveal cap are passed in; the caller (legacy) owns the ledger
// and the hash impl so there is a single source of truth for each.
//
// A regular species reveals one stat field at a time: each field has a fixed (but
// per-species "random") kill threshold in 1..full, so the card fills in as you slay
// more, fully open at `full` kills. A BOSS is all-or-nothing — its lore stays
// sealed until your FIRST kill, then the whole block is known.

// The kill threshold at which a given species reveals a given stat field. Stable
// per (species, field) via the injected hash, so a field's reveal point never
// flickers between peeks. Always in 1..full.
export function fieldRevealThreshold(speciesKey, field, hashFn, full) {
  return 1 + (hashFn(speciesKey + '|' + field) % full);
}

// Is one stat field known yet? Bosses reveal everything on their first kill;
// regular species reveal a field once kills reach its threshold (or `full` total).
export function isBestiaryFieldKnown(speciesKey, field, kills, isBoss, hashFn, full) {
  if (isBoss) return kills >= 1;
  if (kills >= full) return true;
  return kills >= fieldRevealThreshold(speciesKey, field, hashFn, full);
}

// Has this species been recorded at all (≥1 kill)? Drives the codex silhouette →
// portrait flip and the "discovered N / total" tally.
export function speciesDiscovered(kills) { return (kills || 0) >= 1; }

// Fraction of a species' lore uncovered, 0..1 — the codex/card progress bar. A boss
// is binary (0 until slain, then 1); a regular species climbs linearly to `full`.
export function bestiaryRevealRatio(kills, isBoss, full) {
  kills = kills || 0;
  if (isBoss) return kills >= 1 ? 1 : 0;
  return Math.min(kills, full) / full;
}
