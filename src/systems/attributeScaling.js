// Pure attribute-scaling math. Numbers in → numbers out; no globals, no RNG, no
// DOM. The legacy shell passes in the live attribute totals / class / max HP and
// gets back the per-class coefficients and derived Bulwark / heal magnitudes.
//
// All tuning lives in src/data/attributeScaling.js — this module only applies it.

import {
  CLASS_DMG_ATTR, CLASS_DMG_ATTR2, CLASS_DMG_ATTR_FALLBACK,
  ATTR_DMG_PER_POINT, ATTR_DMG_PER_POINT_BASIC, ATTR_DMG_PER_POINT_HYBRID,
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

/** The IDENTITY attribute a class's SKILLS/spells scale off (basic autos use Might). */
export function classDamageAttr(cls) {
  return CLASS_DMG_ATTR[cls] || CLASS_DMG_ATTR_FALLBACK;
}

/**
 * The SECOND identity attribute of a hybrid class, or null for a pure class.
 * A hybrid's skills scale off the SUM of both at the lower hybrid per-point rate.
 * @param {string} cls hero class id
 * @returns {string|null}
 */
export function classDamageAttr2(cls) {
  return CLASS_DMG_ATTR2[cls] || null;
}

/** Both identity attributes of a class, in order — one entry for a pure class, two for a hybrid. */
export function classDamageAttrs(cls) {
  const second = classDamageAttr2(cls);
  return second ? [classDamageAttr(cls), second] : [classDamageAttr(cls)];
}

/** True when the class splits its skill scaling across two attributes. */
export function isHybridClass(cls) {
  return !!CLASS_DMG_ATTR2[cls];
}

/** Per-point skill-damage rate for a class: the lower hybrid rate when it mains two attributes. */
export function classDmgPerPoint(cls) {
  return isHybridClass(cls) ? ATTR_DMG_PER_POINT_HYBRID : ATTR_DMG_PER_POINT;
}

/**
 * Attack power a BASIC (auto) attack gets from MIGHT — universal to every class, but
 * class-scaled via the `basicDmg` channel (warrior best, mage least). The rank-#1
 * class lands at ATTR_DMG_PER_POINT_BASIC — the auto lane's own per-point rate, which
 * runs a touch above the skill lane's (an auto-attack has no cooldown to spend, but no
 * Skill Power to stack either).
 * @param {number} might total Might (base + gear)
 * @param {string} cls hero class id
 * @returns {number}
 */
export function basicAttrDamage(might, cls) {
  return Math.max(0, might) * channelCoef('basicDmg', cls);
}

/** SKILL attack power from the class's identity attribute: (identity attr) × per-point. */
export function attrDamageFor(attrTotal, cls, perPoint = ATTR_DMG_PER_POINT) {
  return Math.max(0, attrTotal) * perPoint;
}

/**
 * SKILL attack power from ALL of a class's identity attributes. A pure class converts
 * its one attribute at ATTR_DMG_PER_POINT; a hybrid converts the SUM of its two at the
 * lower ATTR_DMG_PER_POINT_HYBRID, so a point in either is worth the same.
 * @param {(attr: string) => number} getAttr reads a total attribute value by name
 * @param {string} cls hero class id
 * @returns {number}
 */
export function skillAttrPower(getAttr, cls) {
  const perPoint = classDmgPerPoint(cls);
  let sum = 0;
  for (const attr of classDamageAttrs(cls)) sum += Math.max(0, getAttr(attr) || 0);
  return sum * perPoint;
}

/**
 * Skill-lane attack power ONE attribute is worth per point for a class — 0 when it
 * isn't one of that class's identity attributes. The gear Power model uses this to
 * value a +ATTR roll without re-deriving the pure/hybrid split.
 * @param {string} attr attribute name
 * @param {string} cls hero class id
 * @returns {number}
 */
export function skillAttrCoef(attr, cls) {
  return classDamageAttrs(cls).includes(attr) ? classDmgPerPoint(cls) : 0;
}

/**
 * The Spirit boost to max Veil, as a MULTIPLIER on the Veil granted by other sources.
 * 1.0 at (or below) the baseline Spirit; each point above adds a class-scaled fraction,
 * so Spirit amplifies gear/spell Veil rather than creating any on its own.
 * @param {number} spirit total Spirit (incl. base + gear)
 * @param {string} cls hero class id
 * @returns {number} multiplier (≥ 1)
 */
export function spiritVeilMult(spirit, cls) {
  const mult = SHIELD.classMult[cls] ?? SHIELD.classMultDefault;
  const above = Math.max(0, spirit - SHIELD.spiritBase);
  return 1 + above * SHIELD.spiritBoostPerPoint * mult;
}

/**
 * Max Spirit Veil: the Veil pool from OTHER sources (gear's +Spirit Veil affix,
 * shield spells/buffs), amplified by the Spirit boost. Spirit grants NO Veil on its
 * own — with no source Veil this is 0. Scales independently of HP and is UNCAPPED, so a
 * caster who stacks both VEIL gear and Spirit can end up with a Veil larger than its HP.
 * @param {number} veil Veil from other sources (gear/spells), before the Spirit boost
 * @param {number} spirit total Spirit (incl. base + gear)
 * @param {string} cls hero class id
 * @returns {number} max shield (≥ 0)
 */
export function shieldMax(veil, spirit, cls) {
  return Math.max(0, veil) * spiritVeilMult(spirit, cls);
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
 * gear Power model to value +Spirit's shield. Because Spirit now only BOOSTS the Veil
 * from other sources, the marginal scales with how much source Veil the hero carries:
 * with no VEIL gear/spells, +Spirit buys no shield.
 * @param {number} veil Veil from other sources (gear/spells), before the Spirit boost
 * @param {string} cls hero class id
 * @returns {number}
 */
export function shieldPerSpiritPoint(veil, cls) {
  const mult = SHIELD.classMult[cls] ?? SHIELD.classMultDefault;
  return Math.max(0, veil) * SHIELD.spiritBoostPerPoint * mult;
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
export { ATTR_DMG_PER_POINT, ATTR_DMG_PER_POINT_BASIC, ATTR_DMG_PER_POINT_HYBRID };
