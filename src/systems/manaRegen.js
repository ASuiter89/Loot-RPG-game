// How fast mana comes back — one source of truth for the rate the HERO sheet
// prints, applyRegen() banks each beat, and the fluid MP bar glides at. Pure:
// numbers in, numbers out; no globals, no RNG, no DOM.
//
// The shell owns the SUMS (gear MPREG, Spirit × its class coefficient, passive
// bonuses, the Clarity shrine); this module owns the SHAPE — the flat floor, the
// share-of-pool term that keeps refill time flat as the pool grows with level, and
// the in-combat ration.
import {
  MP_REGEN_FLAT_PER_BEAT, MP_REGEN_PCT_PER_BEAT, MANA_COMBAT_REGEN_MULT,
} from '../data/manaRegen.js';

// A finite, non-negative number or 0 — a corrupt stat must never poison the rate.
// Deliberately strict: `Number(null)` is 0, which would read an ABSENT knob as a
// real zero; only an actual finite number counts.
function num(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
}

/**
 * The UNGATED mana regen rate, in MP per real second. Sums the flat floor, the
 * share-of-max-pool term, and every additive source the shell hands in, then
 * converts the per-beat total to a per-second rate.
 *
 * `shrinePctMp` is a FRACTION OF MAX MP per beat (the Clarity shrine's own units),
 * so it rides the same pool scaling as the baseline percentage term.
 *
 * @param {object} p {maxMp, spirit, gear, skills, shrinePctMp} — `spirit` is the
 *   already class-scaled Spirit contribution per beat, `gear` the flat MPREG total,
 *   `skills` the summed passive mpRegen bonus.
 * @param {number} ticksPerSec world beats per real second.
 * @returns {number} MP per second, never negative.
 */
export function mpRegenPerSec(p, ticksPerSec) {
  const o = p || {};
  const perBeat = MP_REGEN_FLAT_PER_BEAT
    + MP_REGEN_PCT_PER_BEAT * Math.max(0, num(o.maxMp))
    + num(o.spirit) + num(o.gear) + num(o.skills)
    + num(o.shrinePctMp) * Math.max(0, num(o.maxMp));
  return Math.max(0, perBeat * Math.max(0, num(ticksPerSec)));
}

/**
 * The rate actually banked right now: the ungated rate, rationed while in combat.
 * Kept separate from mpRegenPerSec so the HERO sheet can print the true (ungated)
 * rate while applyRegen and the bar fill apply the same gate from one place.
 */
export function gatedMpRegen(rate, inCombat) {
  return Math.max(0, num(rate)) * (inCombat ? MANA_COMBAT_REGEN_MULT : 1);
}

/**
 * Seconds to refill an empty pool at a given ungated rate — the number the tuning
 * above exists to keep FLAT across levels. Infinity when nothing regenerates.
 */
export function secondsToFullMp(maxMp, rate) {
  const r = Math.max(0, num(rate));
  if (!(r > 0)) return Infinity;
  return Math.max(0, num(maxMp)) / r;
}
