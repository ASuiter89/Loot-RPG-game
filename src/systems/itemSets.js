// Pure helpers over the equipment-set data (src/data/itemSets.js). Everything a
// worn count, the rng and the slot needs is passed in, so this stays
// deterministic and unit-testable — no game state, DOM, RNG-inline or clock.
//
// A set is a family of PRE-DEFINED, NAMED, FIXED-stat artifact `pieces` (one per
// slot it covers, each shaped like a unique: native + six mods + power + flavor)
// PLUS set-level bonus tiers and a completion power. These helpers cover the
// count/completion/bonus math and the drop-time piece roll; the fixed-artifact
// build itself lives in the legacy layer (buildSetPiece mirrors buildUnique).

// How many pieces a set has = how many slots it covers. This is the set's
// completion denominator, the "Worn: n / pieceCount" you see in the tooltip.
export function setPieceCount(set) {
  return set && set.pieces ? set.pieces.length : 0;
}

// The highest matched-piece threshold a set's bonus table defines. Authored to
// equal setPieceCount (the completion tier) — kept as its own helper so display
// code can iterate tiers without assuming that invariant.
export function setTopTier(set) {
  const keys = set && set.bonus ? Object.keys(set.bonus).map(Number) : [];
  return keys.length ? Math.max(...keys) : 0;
}

// A set is COMPLETE when every one of its pieces is worn — that unlocks its top
// tier, its completion power and the golden aura.
export function setComplete(set, n) {
  return !!set && n >= setPieceCount(set);
}

// The slots a set covers, one per piece (a set never has two pieces for a slot).
export function setSlots(set) {
  return set && set.pieces ? set.pieces.map(p => p.slot) : [];
}

// Extra value of one stat `name` a single set grants at a worn count of `n`:
// every bonus tier whose threshold is met, plus the completion power's stats once
// the set is complete. Flat (no item-level scaling) and layered ON TOP of the
// fixed stats the pieces themselves carry. Callers sum this across worn sets.
export function setStatContribution(set, n, name) {
  if (!set || !set.bonus) return 0;
  let sum = 0;
  for (const t of Object.keys(set.bonus)) {
    if (n >= +t && set.bonus[t][name] != null) sum += set.bonus[t][name];
  }
  if (set.power && set.power.stats && setComplete(set, n) && set.power.stats[name] != null) {
    sum += set.power.stats[name];
  }
  return sum;
}

// The flat pool of every set piece as { setId, piece } — the drop table a red
// set-piece roll draws from (each piece is a specific fixed artifact def).
export function setPiecePool(sets) {
  const out = [];
  for (const id in sets) {
    const set = sets[id];
    if (!set.pieces) continue;
    for (const piece of set.pieces) out.push({ setId: id, piece });
  }
  return out;
}

// Roll a specific set piece for a drop, using an injected rng (returns 0..1).
// When `slot` is given (the gambler targeting a gear type) the pool is filtered
// to pieces of that slot; otherwise any piece can roll (like uniques draw from
// the whole table). Returns { setId, piece } or null if nothing matches.
export function rollSetPiece(slot, rng, sets) {
  const pool = setPiecePool(sets).filter(sp => !slot || sp.piece.slot === slot);
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

// Every slot in `slotKeys` is covered by at least one set piece — so a set piece
// can roll for any slot the loot table produces. Guards the roster's coverage.
export function setsCoverAllSlots(slotKeys, sets) {
  const covered = new Set();
  for (const id in sets) for (const s of setSlots(sets[id])) covered.add(s);
  return slotKeys.every(s => covered.has(s));
}
