// Which teaching moment the world-pausing spotlight gate should hold right now.
//
// Three beats use the gate: the beach's first-hit Health Potion, the beach's
// starter-weapon equip, and the first-cast Mana Potion. The DOM wiring lives in the
// legacy shell; the DECISIONS live here — pure predicates over a snapshot of live
// state, so they're testable without a canvas.
//
// The first-cast lesson used to gate on `tutorialDone`, on the assumption that the
// shore hands out no spells. It does: clearing the beach IS the hero's first
// level-up, and the cave refuses to open until that skill point is spent — so a
// Guided hero can learn an active (a first active auto-slots into auto-cast) and
// burn mana on the sand, where the lesson silently never fired.
//
// No state, no clock, no DOM.

/**
 * Should the first-cast Mana-Potion lesson arm on the mana just spent?
 *
 * Fires on the first cast that actually costs MANA, wherever it happens — the
 * opening beach included. A cast paid in LIFE never reaches here (there's no mana
 * spend to explain), and the caller latches `taught.firstSpell` so it's once ever.
 *
 * @param {object} state
 * @param {boolean} [state.guided] the hero runs with the teaching layer on
 * @param {object} [state.taught] one-time-lesson latches (`firstSpell` retires this)
 * @param {boolean} [state.inTown] the hero is in the town camp (skills are parked there)
 * @param {number} [state.mp] mana after the cast was paid for
 * @param {number} [state.maxMp] the hero's mana pool
 * @returns {boolean} true when the gate should be raised
 */
export function shouldTeachFirstSpell(state) {
  const s = state || {};
  if (!s.guided) return false;                       // Classic opts out of every lesson
  if (s.taught && s.taught.firstSpell) return false;  // taught once, ever
  if (s.inTown) return false;
  // Only arm when there's mana to restore, so the flask the gate points at is
  // usable — a hero at full MP has nothing to refill and no way to close the gate.
  return Number(s.mp) < Number(s.maxMp);
}

/**
 * Which gate (if any) should hold the screen, highest priority first:
 *
 *  • `null`    — the death card owns the screen; every gate waits its turn.
 *  • `potion`  — the beach's first-hit Health-Potion beat, until the hero quaffs.
 *  • `equip`   — the beach's starter-weapon beat, until it's worn.
 *  • `mana`    — the first-cast Mana-Potion beat, until the hero quaffs.
 *
 * The two BEACH beats outrank the mana beat: both hold the world paused until the
 * taught action fires, but the keyboard stays live behind them, so a hero who casts
 * instead of quaffing must not have the spotlight yanked off the flask they were
 * just told to drink. The mana beat stays wanted and opens the moment the beach
 * beat resolves.
 *
 * @param {object} state
 * @param {boolean} [state.deathCardOpen] the death overlay is up
 * @param {boolean} [state.potionCueOn] the beach first-hit cue is live
 * @param {boolean} [state.equipCueOn] the starter weapon is still unequipped
 * @param {boolean} [state.onShore] the hero is on the beach tutorial
 * @param {boolean} [state.manaWanted] the first-cast lesson is armed and unfinished
 * @param {number} [state.mp] live mana
 * @param {number} [state.maxMp] the hero's mana pool
 * @returns {'potion'|'equip'|'mana'|null}
 */
export function activeGateKind(state) {
  const s = state || {};
  if (s.deathCardOpen) return null;
  if (s.onShore) {
    if (s.potionCueOn) return 'potion';
    if (s.equipCueOn) return 'equip';
  }
  // A refill from anywhere else (a shrine, a level-up) satisfies the lesson too —
  // there'd be nothing left for the flask to restore.
  if (s.manaWanted && Number(s.mp) < Number(s.maxMp)) return 'mana';
  return null;
}
