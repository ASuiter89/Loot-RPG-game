// What a cast COSTS — one source of truth for the price the shell charges, the
// skill bar greys out on, the tooltips print, and gameState() reports. Pure: numbers
// in, numbers out; no globals, no RNG, no DOM.
//
// The bug this module exists to kill: the cost was computed in three places with
// three different answers. castSkillById discounted the rank cost by gear Mana Cost
// Reduction, gameState() mirrored that, and the HUD did not — so a hero with MCR saw
// skills greyed out as "Not enough mana" that would in fact have cast, and read a
// price higher than they were charged. Everything now routes through castCost().
import {
  MIN_CAST_COST, LIFE_COST_PER_MP, BLOOD_PRICE_MULT, AUTO_CAST_LIFE_RESERVE,
} from '../data/skillCosts.js';

// A finite number or the fallback — a corrupt stat must never poison a price.
function num(v, fallback) {
  // Deliberately strict: `Number(null)` and `Number('')` are 0, which would quietly
  // read an ABSENT knob as a real zero. Only an actual finite number counts.
  return (typeof v === 'number' && Number.isFinite(v)) ? v : fallback;
}

/**
 * The MANA a cast actually charges: the skill's rank-scaled cost discounted by gear
 * Mana Cost Reduction. MCR divides rather than subtracting a capped %, so each point
 * does a little less than the last and the price asymptotes toward — but never
 * reaches — free (floored at MIN_CAST_COST). A free skill (base 0) stays free.
 * @param {number} baseMp the rank-scaled cost BEFORE reduction
 * @param {number} mcr    total Mana Cost Reduction % (negatives clamp to 0)
 */
export function castCost(baseMp, mcr) {
  const base = num(baseMp, 0);
  if (!(base > 0)) return 0;
  return Math.max(MIN_CAST_COST, Math.round(base / (1 + Math.max(0, num(mcr, 0)) / 100)));
}

/**
 * The HEALTH a no-mana class pays for a cast of `mpCost` mana: a share of MAX HP per
 * point of the (already MCR-discounted) cost, so the toll tracks the health pool
 * instead of fading to nothing as it grows. Always at least 1 — a cast is never free
 * blood. `doubled` is the Blood Price keystone.
 */
export function lifeCost(maxHp, mpCost, doubled = false) {
  const hp = Math.max(0, num(maxHp, 0));
  const cost = Math.max(0, num(mpCost, 0));
  const mult = doubled ? BLOOD_PRICE_MULT : 1;
  return Math.max(1, Math.round(hp * LIFE_COST_PER_MP * cost * mult));
}

/**
 * Can the hero pay for this cast right now? Mana casts check the pool; life casts
 * check that paying leaves them ALIVE (strictly above the toll) — a self-inflicted
 * cost never kills. A free cast is always affordable.
 * @param {object} p {hp, mp, cost, life} — `cost` is the charged mana, `life` the
 *   charged health (0/absent when the hero pays in mana).
 */
export function canAfford({ hp, mp, cost, life }) {
  const c = Math.max(0, num(cost, 0));
  if (!c) return true;
  const toll = Math.max(0, num(life, 0));
  if (toll > 0) return num(hp, 0) > toll;
  return num(mp, 0) >= c;
}

/**
 * May the AUTO-CAST slot pay a blood toll right now? Unlike a keypress, auto-cast
 * fires the moment a skill is ready, so without a floor it drains a blood-caster to
 * a sliver and holds them there. It must leave AUTO_CAST_LIFE_RESERVE of max HP
 * standing. A cast with no blood toll (mana, or free) is always allowed.
 */
export function autoCastAffordsLife(hp, maxHp, life) {
  const toll = Math.max(0, num(life, 0));
  if (!toll) return true;
  const max = Math.max(0, num(maxHp, 0));
  return num(hp, 0) - toll >= max * AUTO_CAST_LIFE_RESERVE;
}

/**
 * The price to PRINT for a cast: "18 HP" for a blood-caster, "31 MP" otherwise, and
 * "free" when it costs nothing. `life` is the blood toll (0 when paid in mana).
 */
export function costLabel(cost, life) {
  const c = Math.max(0, num(cost, 0));
  const toll = Math.max(0, num(life, 0));
  if (toll > 0) return `${toll} HP`;
  if (!c) return 'free';
  return `${c} MP`;
}
