// AoE / ranged-cast line-of-sight targeting — WHERE a cast draws its line from.
//
// A ranged cast can't reach a foe THROUGH a wall, but the origin of that line
// depends on the shape:
//   • A bolt, beam (line), nova or chain radiates from the HERO, so each struck foe
//     needs a clear line FROM THE HERO.
//   • A BLAST is a projectile that flies to a foe and DETONATES on impact. Its
//     explosion should spread from the POINT OF IMPACT — catching foes the hero
//     can't personally see but that stand right beside the blast (a meteor landing
//     among a pack tucked behind a wall still burns the whole pack). The projectile
//     itself must reach the impact (hero → impact must be clear), but the SPLASH is
//     judged from the impact tile, not the hero.
//
// This module encodes that rule as pure functions over an injected line-of-sight
// predicate `hasLos(ax, ay, bx, by)`, so it stays deterministic and unit-testable
// while the real LOS raycast lives at the edge (src/legacy/game.js).

// Cast shapes whose area of effect radiates from the point of IMPACT (a projectile
// that bursts on a foe), NOT from the hero. Their splash is judged by LOS from the
// impact tile. Every other ranged shape emanates from the hero.
export const IMPACT_AOE_SHAPES = new Set(['blast']);

/** True if a cast shape's AoE spreads from an impact point away from the hero. */
export function isImpactAoeShape(shape) {
  return IMPACT_AOE_SHAPES.has(shape);
}

/**
 * The foes actually caught by a splash centred on (ox, oy): every candidate the
 * impact tile can SEE. Walls between the hero and a foe no longer matter — only
 * walls between the IMPACT and the foe do. The origin tile always sees itself, so a
 * foe standing on the impact is included.
 * @param {number} ox impact tile x
 * @param {number} oy impact tile y
 * @param {Array<{x:number,y:number}>} candidates foes already gathered by radius
 * @param {(ax:number,ay:number,bx:number,by:number)=>boolean} hasLos LOS predicate
 * @returns {Array} the subset with a clear line from the impact point
 */
export function splashTargetsFrom(ox, oy, candidates, hasLos) {
  if (ox == null || oy == null || typeof hasLos !== 'function') return [];
  return (candidates || []).filter(e => e && e.x != null && hasLos(ox, oy, e.x, e.y));
}

/**
 * The next link in a lightning-style CHAIN: the nearest unhit candidate within
 * `maxStep` (Manhattan) of the LAST struck foe that the last foe can SEE. The arc
 * leaps from foe to foe, so each hop needs a clear line from the PREVIOUS link — NOT
 * from the hero — which lets a chain bend around a corner the hero can't see past.
 * Returns null when no reachable candidate remains (the chain ends there). Ties break
 * toward the earlier candidate (strict `<`), matching the enemy-array order.
 * @param {{x:number,y:number}} last the previously struck foe the arc jumps from
 * @param {Array<{x:number,y:number}>} candidates living, not-yet-hit foes
 * @param {number} maxStep max Manhattan jump distance
 * @param {(ax:number,ay:number,bx:number,by:number)=>boolean} hasLos LOS predicate
 * @returns {object|null} the next foe, or null
 */
export function nextChainLink(last, candidates, maxStep, hasLos) {
  if (!last || last.x == null || typeof hasLos !== 'function') return null;
  let best = null, bestD = Infinity;
  for (const o of (candidates || [])) {
    if (!o || o.x == null) continue;
    const d = Math.abs(o.x - last.x) + Math.abs(o.y - last.y);
    if (d <= maxStep && d < bestD && hasLos(last.x, last.y, o.x, o.y)) { best = o; bestD = d; }
  }
  return best;
}

/**
 * Filter a ranged cast's gathered targets by line of sight from the correct ORIGIN
 * for its shape.
 *   • blast (isImpactAoeShape) — the burst spreads from `center` (the impact foe).
 *     The projectile must first reach the impact, so a `center` the hero can't see
 *     fizzles the whole cast (returns []). Otherwise every foe the IMPACT can see is
 *     caught, regardless of walls between it and the hero.
 *   • every other ranged shape (bolt, nova, line, teleport, …) radiates from the
 *     hero, so each foe must have a clear line from the hero.
 * Melee / cleave / random ignore walls by design and should never be passed here.
 * CHAIN is gated link-to-link as it is built (see nextChainLink), not here.
 * @param {string} shape cast shape
 * @param {Array<{x:number,y:number}>} targets foes gathered by the shape
 * @param {{x:number,y:number}} center impact/anchor tile of the cast
 * @param {{x:number,y:number}} hero the caster's tile
 * @param {(ax:number,ay:number,bx:number,by:number)=>boolean} hasLos LOS predicate
 * @returns {Array} the surviving targets
 */
export function castTargetsInSight(shape, targets, center, hero, hasLos) {
  if (!targets || !targets.length || typeof hasLos !== 'function' || !hero) return [];
  if (isImpactAoeShape(shape)) {
    // The projectile can't reach — nor detonate on — an impact the hero can't see.
    if (!center || center.x == null || !hasLos(hero.x, hero.y, center.x, center.y)) return [];
    return splashTargetsFrom(center.x, center.y, targets, hasLos);
  }
  return targets.filter(e => e && e.x != null && hasLos(hero.x, hero.y, e.x, e.y));
}
