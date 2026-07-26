// Where a killing blow actually sends the hero.
//
// A death in the dungeon is the familiar trip to TOWN with penalties — but the
// opening BEACH is a tutorial, so falling on it is a plain RETRY: the shore is
// rebuilt and the hero wakes at the water's edge. Town is the wrong place for a
// hero who hasn't finished the shore. A save taken in town never resumes the beach
// (see tutorialResume.js), so one unlucky stumble on the very first map used to
// skip the whole tutorial for good — the starter weapon it hands over, the
// level-up earned by clearing it, and the cave that opens onto floor 1.
//
// Pure decision over a small snapshot of hero/world flags — no state, no clock,
// no DOM. The legacy shell (handleDeath) runs whichever route this names.

/**
 * Which path a killing blow takes, highest priority first:
 *
 *  • `laststand`  — the free once-per-floor save: cling to 1 HP and fight on.
 *  • `revive`     — a Phoenix/Everything bowl is burned to rise where you stand.
 *  • `permadeath` — Hardcore's one life is spent. The shore is no exception: one
 *                   life means one life, tutorial included.
 *  • `shore`      — fell on the beach tutorial → rebuild it and retry, cost-free.
 *  • `town`       — the ordinary dungeon death: revive in town, minus gold/XP/bag.
 *
 * @param {object} state
 * @param {boolean} [state.lastStandReady] the free save is still armed this floor
 * @param {boolean} [state.reviveBuff] a food buff carrying a `revive` is active
 * @param {boolean} [state.hardcore] this hero was created in Hardcore mode
 * @param {boolean} [state.tutorialActive] the hero is on the opening beach
 * @param {boolean} [state.inTown] the hero is standing in the town camp
 * @returns {'laststand'|'revive'|'permadeath'|'shore'|'town'}
 */
export function deathRoute(state) {
  const s = state || {};
  if (s.lastStandReady) return 'laststand';
  if (s.reviveBuff) return 'revive';
  if (s.hardcore) return 'permadeath';
  // `inTown` is belt-and-braces: the shore and the town are never both live, but a
  // stale flag must never strand a town death on a beach that isn't there.
  if (s.tutorialActive && !s.inTown) return 'shore';
  return 'town';
}
