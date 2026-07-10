// Skill damage-preview math — turns a hit's raw damage span into an effective
// single-target DPS by folding in crit and cast rate. Pure and deterministic:
// numbers in, numbers out, no globals, no RNG (crit is modelled as its expected
// value, not rolled). The live-stat gathering — weapon range, gear/attribute
// multipliers, enemy armour at depth — happens in the legacy adapter
// (`skillDamagePreview` in src/legacy/game.js), which then feeds these functions.
//
// The two numbers a skill tooltip shows:
//   • RAW RANGE  — the literal min..max a single hit can roll (crit excluded), as
//     it appears in floating combat text. Computed by the adapter; formatted for
//     display by src/utils/format.js.
//   • EFFECTIVE DPS — the raw range averaged with crit chance/damage, multiplied
//     by hits-per-cast and casts-per-second (this module).

// The hard floor the real recharge clamps to (see setSkillCd in the monolith): no
// active can fire faster than once every half-second no matter how much haste is
// stacked, so DPS honours the same cap.
export const MIN_SKILL_CD = 0.5;

/**
 * Multiplicative recharge haste for an active, matching the cast pipeline: every
 * active is sped by Cooldown Reduction; spells get Cast Speed on top; a skill adds
 * whatever recharge its milestone SURGES grant. `cdr`/`castSpd` are raw stat percents
 * (0 = none). `surge` is the summed milestone recharge FRACTION (0.20 = +20% faster,
 * from systems/skillSurge.js → surgeHasteFrac) — the per-archetype successor to the
 * old blanket rank-7 "Honed" cut. `honed` is the legacy flat ✦✦ factor, kept so the
 * boolean form still means ×1.20; the live path passes `surge` instead.
 * @param {{cdr?:number, castSpd?:number, isSpell?:boolean, honed?:boolean, surge?:number}} p
 * @returns {number} haste factor ≥ 1
 */
export function castHaste({ cdr = 0, castSpd = 0, isSpell = false, honed = false, surge = 0 } = {}) {
  let h = 1 + Math.max(0, cdr) / 100;          // Cooldown Reduction — every active
  if (isSpell) h *= 1 + Math.max(0, castSpd) / 100; // Cast Speed — spells only
  if (honed) h *= 1.20;                          // legacy flat ✦✦ Honed factor
  if (surge > 0) h *= 1 + surge;                 // per-archetype milestone recharge
  return h;
}

/**
 * A skill's real recharge in seconds: base cooldown divided by haste, floored at
 * MIN_SKILL_CD. A missing/zero base cooldown still yields the floor.
 * @param {number} baseCd base cooldown in seconds
 * @param {number} haste haste factor from castHaste (≥ 1)
 * @returns {number}
 */
export function effectiveCooldown(baseCd, haste) {
  const h = haste > 0 ? haste : 1;
  return Math.max(MIN_SKILL_CD, (baseCd || 0) / h);
}

/**
 * How many times per second the skill can be cast at the given haste.
 * @param {number} baseCd
 * @param {number} haste
 * @returns {number}
 */
export function castsPerSecond(baseCd, haste) {
  return 1 / effectiveCooldown(baseCd, haste);
}

/**
 * Expected damage multiplier from crit: a hit crits with probability `critChance`
 * (clamped to 0..1) for `critMult`× damage, otherwise lands normally. So the
 * average hit is worth 1 + p·(critMult − 1) of a normal hit.
 * @param {number} critChance 0..1
 * @param {number} critMult e.g. 2.0 = double damage on crit
 * @returns {number}
 */
export function critAverageMult(critChance, critMult) {
  const p = Math.min(1, Math.max(0, critChance || 0));
  return 1 + p * (Math.max(0, critMult) - 1);
}

/**
 * Average damage of a single hit: the midpoint of the raw min..max span, lifted
 * by the expected crit multiplier.
 * @param {number} min raw hit minimum (crit excluded)
 * @param {number} max raw hit maximum (crit excluded)
 * @param {number} critChance 0..1
 * @param {number} critMult
 * @returns {number}
 */
export function averageHitDamage(min, max, critChance, critMult) {
  return ((min + max) / 2) * critAverageMult(critChance, critMult);
}

/**
 * Effective sustained single-target DPS: average hit × hits-per-cast ×
 * casts-per-second. `hitsPerCast` covers multi-strike flurries (cast.repeat);
 * it is not the number of AoE targets (DPS is quoted against one foe).
 * @param {{min:number,max:number,critChance:number,critMult:number,hitsPerCast?:number,castsPerSec:number}} p
 * @returns {number}
 */
export function effectiveDps({ min, max, critChance, critMult, hitsPerCast = 1, castsPerSec }) {
  return averageHitDamage(min, max, critChance, critMult) * Math.max(1, hitsPerCast) * castsPerSec;
}
