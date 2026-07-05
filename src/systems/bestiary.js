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

// ── Account-wide ledger shape + merge algebra ───────────────────────────────
// The codex's kill tally + specimen lore are ACCOUNT-WIDE — shared across every
// hero and save slot, so slaying a species on one hero fills in its card for all of
// them. These pure helpers own the ledger's shape and its merge rules; the shell
// (legacy) does the localStorage I/O, so there is one tested source of truth.

// A fresh, empty ledger: a cumulative lifetime kill count per species key, the
// DEEPEST specimen's numbers per key, and a last-write time (for future syncing).
export function emptyDex() { return { kills: {}, lore: {}, ts: 0 }; }

// Coerce arbitrary parsed JSON into a valid ledger: drop non-positive/NaN kills and
// malformed lore so a corrupt or hand-edited file can never poison a read.
export function sanitizeDex(raw) {
  const dex = emptyDex();
  if (!raw || typeof raw !== 'object') return dex;
  if (raw.kills && typeof raw.kills === 'object') {
    for (const k in raw.kills) { const n = Math.floor(+raw.kills[k]); if (n > 0) dex.kills[k] = n; }
  }
  if (raw.lore && typeof raw.lore === 'object') {
    for (const k in raw.lore) { const L = sanitizeLore(raw.lore[k]); if (L) dex.lore[k] = L; }
  }
  dex.ts = (typeof raw.ts === 'number' && raw.ts > 0) ? raw.ts : 0;
  return dex;
}

// Normalize one specimen record to finite numbers (or null if unusable).
function sanitizeLore(L) {
  if (!L || typeof L !== 'object') return null;
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
  return { level: num(L.level), hp: num(L.hp), dmg: num(L.dmg), armor: num(L.armor), mres: num(L.mres) };
}

// The deeper of two specimens — higher level wins, ties keep the incumbent — so the
// codex always shows the strongest form of a species you have faced.
export function deeperSpecimen(prev, next) {
  const n = sanitizeLore(next);
  if (!n) return prev || null;
  if (!prev) return n;
  return (n.level || 0) >= (prev.level || 0) ? n : prev;
}

// Fold a legacy PER-HERO bestiary (a kills map + a lore map, from before the ledger
// went account-wide) INTO a ledger in place: SUM the kills into the cumulative
// lifetime total, keep the deeper lore. Mutates and returns `dex`.
export function foldLegacyBestiary(dex, kills, lore) {
  if (kills && typeof kills === 'object') {
    for (const k in kills) { const n = Math.floor(+kills[k]); if (n > 0) dex.kills[k] = (dex.kills[k] || 0) + n; }
  }
  if (lore && typeof lore === 'object') {
    for (const k in lore) { const L = sanitizeLore(lore[k]); if (L) dex.lore[k] = deeperSpecimen(dex.lore[k], L); }
  }
  return dex;
}

// Record ONE kill of a species into a ledger in place: +1 to its lifetime count and
// update its deeper-specimen lore. Mutates and returns `dex`.
export function recordKill(dex, key, specimen) {
  dex.kills[key] = (dex.kills[key] || 0) + 1;
  const L = deeperSpecimen(dex.lore[key], specimen);
  if (L) dex.lore[key] = L;
  return dex;
}
