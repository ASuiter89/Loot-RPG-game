// Boss/elite crowd-control resistance ("tenacity"). Two mechanisms, both keyed by
// the foe's class, that together make a guardian genuinely lockable for a beat but
// IMPOSSIBLE to stunlock:
//   • a flat DURATION cut on every hard crowd-control (stun/freeze) that lands, and
//   • DIMINISHING RETURNS on repeated hard CC in a short window — each successive
//     stun is a fraction of the last, and once it shrinks past a floor the foe
//     shrugs it off outright (there is always a mandatory gap).
//
// Ordinary foes have NO profile here and are unaffected — their stuns land in full,
// exactly as before. This is the boss/elite twin of the hero's own Tenacity (TENAC),
// which shortens crowd-control landing on the player.
//
// Kept as data (not logic): one tidy table to tune, validated by
// test/data/tenacity.test.js. The math that reads it is src/systems/tenacity.js.

// The lock effects diminishing returns guard against. Soft CC (slow/chill) is left
// alone on purpose: it only slows a foe, never locks it out of acting, and chill is
// meant to ride every ice hit.
export const HARD_CC = new Set(['stun', 'freeze']);

// tier → profile.
//   tenac       flat fraction shaved off every hard-CC duration (0.5 = halved).
//   drSteps     duration multiplier for the 1st, 2nd, 3rd… hard CC within the
//               window; past the end of the list the foe is immune. A step that
//               shrinks a stun below floorSecs also counts as immune.
//   windowSecs  a hard-CC-free stretch this long resets the DR ladder to step 0.
//   floorSecs   a post-cut stun shorter than this is shrugged off (shown as RESIST).
export const TENACITY = {
  // Guardians: stuns halved, then quartered, then eighth'd — a third lands as a
  // blink and every one after that is shrugged for the rest of the 8s window.
  boss:  { tenac: 0.5,  drSteps: [1, 0.5, 0.25], windowSecs: 8, floorSecs: 0.4 },
  // Elites: a lighter version of the same guard.
  elite: { tenac: 0.25, drSteps: [1, 0.6, 0.35], windowSecs: 6, floorSecs: 0.4 },
};
