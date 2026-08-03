// ── UP-STAIR / TOWN-EXIT PLACEMENT ───────────────────────────────────────────
//
// Every generated floor lays two stairs: the one under your feet, back the way you
// came, and a far one leading onward. On floors 2+ the "up" stair is a real
// staircase to the floor above. Floor 1 of a difficulty has nothing above it, so
// its up-stair stands in as the way back to TOWN and is drawn as the red dungeon
// gate.
//
// But the town isn't OPEN until the Floor-5 guardian falls. So a brand-new hero
// walks out of the beach cave and spawns standing on a gate that can only ever
// refuse them ("there is no road back to town yet") — a prop that reads like a way
// back to the shore and does nothing at all. Withhold it until it leads somewhere;
// the first floor's only way on is down, which is exactly what the ramp teaches.
//
// Pure predicate over two flags — no state, no map, no DOM.

/**
 * Should this floor carry its UP stair (the red town gate on floor 1, a staircase
 * deeper in)?
 *
 * @param {object} state
 * @param {number} [state.displayFloor] the floor's number WITHIN its difficulty
 * @param {boolean} [state.townUnlocked] the Floor-5 guardian has fallen, so the
 *   town — and with it the floor-1 gate's destination — exists
 * @returns {boolean} false only for a floor-1 gate with no town behind it
 */
export function upStairPlaced(state) {
  const s = state || {};
  // Deeper floors always get theirs: it climbs to a floor that definitely exists.
  if (Math.floor(Number(s.displayFloor)) !== 1) return true;
  return !!s.townUnlocked;
}
