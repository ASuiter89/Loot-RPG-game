// Pure attribute-scaling math. Numbers in → numbers out; no globals, no RNG, no
// DOM. The legacy shell passes in the live attribute totals / class / max HP and
// gets back the per-class coefficients and derived Bulwark / heal magnitudes.
//
// All tuning lives in src/data/attributeScaling.js — this module only applies it.

import {
  CLASS_DMG_ATTR, CLASS_DMG_ATTR_FALLBACK, ATTR_DMG_PER_POINT,
  CLASS_SCALE_LADDER, ATTR_STAT_CHANNELS, SHIELD,
} from '../data/attributeScaling.js';

/**
 * The per-point coefficient of an attribute→stat channel for a given class,
 * i.e. `base × ladder[rank]`. A class absent from the channel's ordering
 * (classless legacy save, or an unknown class) falls back to the base value
 * (ladder rank #2 == 1.0), so behaviour degrades gracefully.
 * @param {string} channel key in ATTR_STAT_CHANNELS
 * @param {string} cls hero class id
 * @returns {number}
 */
export function channelCoef(channel, cls) {
  const ch = ATTR_STAT_CHANNELS[channel];
  if (!ch) return 0;
  const idx = ch.order.indexOf(cls);
  const mult = idx >= 0 ? CLASS_SCALE_LADDER[idx] : 1;
  return ch.base * mult;
}

/** The attribute a class's weapon/skill damage scales off. */
export function classDamageAttr(cls) {
  return CLASS_DMG_ATTR[cls] || CLASS_DMG_ATTR_FALLBACK;
}

/** Attack power contributed by attributes: (that class's damage attr) × per-point. */
export function attrDamageFor(attrTotal, cls, perPoint = ATTR_DMG_PER_POINT) {
  return Math.max(0, attrTotal) * perPoint;
}

/**
 * Max Spirit Veil: total Spirit × per-point × class multiplier. Scales LINEARLY off
 * Spirit, independently of HP and with NO cap — a Spirit-stacked build's Veil can
 * exceed its HP. Per point it is deliberately below Vitality→HP, so it accrues slower.
 * @param {number} spirit total Spirit (incl. base + gear)
 * @param {string} cls hero class id
 * @returns {number} max shield (≥ 0)
 */
export function shieldMax(spirit, cls) {
  const mult = SHIELD.classMult[cls] ?? SHIELD.classMultDefault;
  return Math.max(0, spirit) * SHIELD.perSpirit * mult;
}

/**
 * Bulwark recharge rate as a FRACTION of max shield per second. Base rate is
 * class-flat; Spirit above the starting baseline speeds it up a little, scaled by
 * the class multiplier, and the whole thing is capped.
 * @param {number} spirit total Spirit
 * @param {string} cls hero class id
 * @returns {number} fraction of max shield restored per second
 */
export function shieldRechargePerSec(spirit, cls) {
  const mult = SHIELD.classMult[cls] ?? SHIELD.classMultDefault;
  const above = Math.max(0, spirit - SHIELD.spiritBase);
  const pct = SHIELD.baseRechargePct + above * SHIELD.rechargePctPerSpirit * mult;
  return Math.min(SHIELD.rechargeMaxPct, pct);
}

/** Seconds of no-damage required before Bulwark starts recharging (class-flat). */
export function shieldRechargeDelay() {
  return SHIELD.rechargeDelay;
}

/**
 * Max Spirit Veil gained per point of Spirit for a class — the marginal used by the
 * gear Power model to value +Spirit's shield.
 * @param {string} cls hero class id
 * @returns {number}
 */
export function shieldPerSpiritPoint(cls) {
  const mult = SHIELD.classMult[cls] ?? SHIELD.classMultDefault;
  return SHIELD.perSpirit * mult;
}

/**
 * Raw heal magnitude (before clamping to missing HP). Folds in the Spirit channel
 * (class-scaled), skill rank, and the spell-power multiplier. There is no longer a
 * flat %-of-max-HP cap — the caller clamps only to the HP actually missing.
 * @param {number} flat per-skill flat base
 * @param {number} perLevel per-skill per-level term
 * @param {number} level hero level
 * @param {number} spirit total Spirit
 * @param {string} cls hero class id
 * @param {number} rankScale skill rank magnitude scalar
 * @param {number} spellMult spell-power multiplier (SPELLPWR gear / class / buffs)
 * @returns {number} raw heal amount
 */
export function healAmount(flat, perLevel, level, spirit, cls, rankScale = 1, spellMult = 1) {
  const coef = channelCoef('heal', cls);
  const base = flat + level * perLevel + Math.max(0, spirit) * coef;
  return base * rankScale * spellMult;
}

// Re-export so the shell can import tuning + math from one place.
export { ATTR_DMG_PER_POINT };
