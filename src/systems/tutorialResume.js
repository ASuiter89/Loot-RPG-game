// Where a loaded save puts the hero: still on the opening BEACH tutorial, or on a
// real dungeon floor.
//
// The shore runs at dungeonLevel 1 — the SAME number as the real floor 1 — so the
// floor alone can never tell the two apart. Saves therefore carry an explicit
// `tutorial` flag, and boot reads it here. Without it, quitting mid-tutorial (which
// loading a slot does: it reloads the page) dropped the hero straight into the
// dungeon, skipping the starter weapon and the shore's first level-up.
//
// Pure predicates over a parsed save blob / a hero's gear — no state, no clock.

/**
 * Was this save taken ON the beach tutorial, so boot should rebuild the shore?
 *
 * A save that predates the flag has no `tutorial` field and reads as false, so
 * neither a hero from before the beach shipped nor one already carried into the
 * dungeon is ever dragged back to it.
 *
 * @param {object|null|undefined} save parsed save blob (`{ player, tutorial, inTown, … }`)
 * @returns {boolean} true when the hero should resume on the shore
 */
export function savedOnShore(save) {
  if (!save || !save.player || typeof save.player !== 'object') return false;
  if (save.inTown) return false;             // town is only reachable after graduating
  if (save.player.tutorialDone) return false; // shore already finished — never replay it
  return save.tutorial === true;
}

/**
 * Does this hero already hold the shore's one starter weapon?
 *
 * Resuming a mid-shore save rebuilds the beach from scratch, foes included, so the
 * "first foe felled hands over a weapon" latch has to be seeded from the hero rather
 * than cleared — otherwise re-felling the respawned pack gifts a second weapon. The
 * gift may sit in the bag OR be worn, so both are checked.
 *
 * @param {Array|null|undefined} inventory the hero's bag
 * @param {Array|null|undefined} gearSets the hero's gear sets (each a slot→item map)
 * @returns {boolean} true when the starter gift has already been handed over
 */
export function hasStarterGift(inventory, gearSets) {
  const bag = Array.isArray(inventory) ? inventory : [];
  if (bag.some(it => it && it.tutorialGift)) return true;
  const sets = Array.isArray(gearSets) ? gearSets : [];
  return sets.some(set => set && typeof set === 'object'
    && Object.values(set).some(it => it && it.tutorialGift));
}
