// Pure helpers over the equipment-set data (src/data/itemSets.js). Everything a
// worn count, the rng and the slot needs is passed in, so this stays
// deterministic and unit-testable — no game state, DOM, RNG-inline or clock.

// How many pieces a set has = how many slots it can fill. This is the set's
// completion denominator, the "Worn: n / pieceCount" you see in the tooltip.
export function setPieceCount(set) {
  return set && set.slots ? set.slots.length : 0;
}

// The highest matched-piece threshold a set's bonus table defines. Authored to
// equal setPieceCount (the completion tier) — kept as its own helper so display
// code can iterate tiers without assuming that invariant.
export function setTopTier(set) {
  const keys = set && set.bonus ? Object.keys(set.bonus).map(Number) : [];
  return keys.length ? Math.max(...keys) : 0;
}

// A set is COMPLETE when every one of its pieces is worn — that unlocks its top
// tier, its signature power and the golden aura.
export function setComplete(set, n) {
  return !!set && n >= setPieceCount(set);
}

// Extra value of one stat `name` a single set grants at a worn count of `n`:
// every bonus tier whose threshold is met, plus the signature power's stats once
// the set is complete. Flat (no item-level scaling) like the rest of set
// bonuses. Callers sum this across all worn sets.
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

// Pick the id of a set that has a piece for `slot`, using an injected rng
// (returns 0..1). Set pieces only ever roll for a slot their set actually
// covers, so a set never advertises a slot it can't fill. Returns null when no
// set covers the slot (guarded against by setsCoverAllSlots — shouldn't happen).
export function rollItemSetId(slot, rng, sets) {
  const ids = Object.keys(sets).filter(id => sets[id].slots.includes(slot));
  if (!ids.length) return null;
  return ids[Math.floor(rng() * ids.length)];
}

// Every slot in `slotKeys` is covered by at least one set — so a set piece can
// roll for any slot the loot table produces. Guards the set roster's coverage.
export function setsCoverAllSlots(slotKeys, sets) {
  const covered = new Set();
  for (const id in sets) for (const s of sets[id].slots) covered.add(s);
  return slotKeys.every(s => covered.has(s));
}
