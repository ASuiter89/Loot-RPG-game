// Mana-regeneration tuning — how fast the pool refills between casts. Pure values;
// the math that reads them lives in src/systems/manaRegen.js and the shell sums the
// gear/attribute/shrine terms in mpRegenPerSec().
//
// Every term below is expressed PER WORLD BEAT (the shell multiplies the total by
// TICKS_PER_SEC to get the real per-second rate the HERO sheet prints), matching the
// units the Clarity shrine's mpRegenPctMp already used.
//
// WHY THERE IS A PERCENTAGE TERM. Regen used to be flat-only: a fixed trickle plus
// Spirit. But the POOL grows with level (2.5 MP/level) while a flat trickle does not,
// so refilling got strictly slower every level — a base-Spirit hero went from ~130s
// to refill a full bar at level 10 to ~450s at level 60. Casting therefore stopped
// being a rhythm and became "burn the bar, then wait on a flask". The percentage term
// ties the trickle to the pool it is filling, so the refill TIME stays flat as the
// hero levels and mana reads as a rechargeable resource rather than a consumable.

// Flat floor, every class, every level. Keeps a hero with no Spirit and no gear from
// sitting at literally zero regen.
export const MP_REGEN_FLAT_PER_BEAT = 0.15;

// Share of MAX MP restored per beat. At 2.5 beats/sec this is 3%/sec, so a full bar
// refills in ~33s out of combat regardless of level or class — the pool and its
// trickle grow together. Gear/Spirit/shrine regen all stack ON TOP of this.
export const MP_REGEN_PCT_PER_BEAT = 0.012;

// Multiplier applied to the WHOLE regen rate while in combat (a few seconds after
// dealing or taking damage). Mana is still rationed mid-fight — a spender cannot
// simply refill through a fight — but at the old 0.5 the ration plus a flat-only
// trickle meant a sustained rotation ran at under 15% of its cooldown cadence.
export const MANA_COMBAT_REGEN_MULT = 0.65;
