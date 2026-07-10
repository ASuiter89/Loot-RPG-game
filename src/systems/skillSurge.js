// Per-skill milestone SURGES — the pure engine behind the varied rank 3 / 7 / 10
// signatures. Given an active's `cast` descriptor it (1) sorts the ability into an
// archetype, (2) resolves the three milestone perks (a bespoke override wins over the
// archetype default), (3) folds every reached perk's mods into a NEW cast copy, and
// (4) reports the summed recharge speed-up. Deterministic and side-effect-free:
// data in, data out, no globals, no RNG, no DOM. The legacy adapter (resolveCast /
// castSkillById / skillDamagePreview in src/legacy/game.js) feeds it the live rank and
// applies the returned cast; the display reads the perks for the "Rank bonuses" ladder.
//
// See src/data/skillSurges.js for the archetype table and the mod vocabulary.

import {
  ACTIVE_SURGE_ARCHETYPES, ACTIVE_SURGE_OVERRIDES, DEFAULT_SURGE_ARCHETYPE,
  SURGE_MILESTONE_RANKS,
} from '../data/skillSurges.js';

export { SURGE_MILESTONE_RANKS };

/**
 * Sort a cast descriptor into a surge archetype. The rules read the same shape +
 * trait cues resolveCast does, so the perk always fits how the ability actually
 * plays. Returns a key of ACTIVE_SURGE_ARCHETYPES (falls back to 'strike').
 * @param {object|null|undefined} cast a node's `cast` descriptor
 * @returns {string}
 */
export function activeArchetype(cast) {
  if (!cast || typeof cast !== 'object') return DEFAULT_SURGE_ARCHETYPE;
  if (cast.summon) return 'conjure';                 // any summon — army first
  const dealsDmg = cast.wpn != null || cast.spell != null;
  const shape = cast.shape;
  if (!dealsDmg) {
    // No direct damage → a support cast. Heal, then blink (teleport), else a self-buff.
    if (cast.heal) return 'mend';
    if (shape === 'teleport') return 'blink';
    return 'ward';
  }
  switch (shape) {
    case 'chain':    return 'arc';
    case 'line':     return 'lance';
    case 'random':   return 'storm';
    case 'blast':    return 'siege';
    case 'nova':     return cast.status ? 'affliction' : 'burst';
    case 'cleave':   return 'cleave';
    case 'teleport': return 'assassinate';           // a damaging blink is an assassination
    case 'melee':    return cast.repeat ? 'flurry' : ((cast.execute || cast.crit) ? 'assassinate' : 'strike');
    case 'bolt':     return (cast.execute || cast.crit) ? 'assassinate' : 'bolt';
    default:         return DEFAULT_SURGE_ARCHETYPE;
  }
}

/**
 * Resolve the three milestone perks for a node: a per-id override if one exists,
 * otherwise the perks of its archetype. Returns null for a node with no `cast` (a
 * passive / non-active), so callers can skip it.
 * @param {{id?:string, cast?:object}|null|undefined} node
 * @returns {{archetype:string, perks:Object}|null}
 */
export function activeSurgePerks(node) {
  const cast = node && node.cast;
  if (!cast) return null;
  const archetype = activeArchetype(cast);
  const override = node.id && ACTIVE_SURGE_OVERRIDES[node.id];
  const perks = override || ACTIVE_SURGE_ARCHETYPES[archetype] || ACTIVE_SURGE_ARCHETYPES[DEFAULT_SURGE_ARCHETYPE];
  return { archetype, perks };
}

// Which milestone perks a given rank has EARNED (rank ≥ the milestone rank), in
// order. Used by the display to know which "Rank bonuses" rows light up, and by the
// mod/haste folding below.
function reachedRanks(rank) {
  const r = rank || 0;
  return SURGE_MILESTONE_RANKS.filter(m => r >= m);
}

/**
 * Fold every EARNED milestone's cast mods into a fresh cast copy. Pure: the input
 * cast (and its nested status/summon/buff/heal objects) is never mutated — a clone is
 * made lazily the first time a mod actually applies, so a rank-0 / no-perk cast is
 * returned untouched (same reference) for cheapness.
 * @param {object} cast the (already transform-applied) cast
 * @param {number} rank the skill's current rank
 * @param {object|null} perks the { rank: {mods} } table from activeSurgePerks().perks
 * @returns {object} the cast to resolve
 */
export function applySurgeCastMods(cast, rank, perks) {
  if (!cast || !perks) return cast;
  let c = cast, cloned = false;
  const own = () => { if (!cloned) { c = Object.assign({}, c); cloned = true; } };
  for (const rk of reachedRanks(rank)) {
    const m = perks[rk] && perks[rk].mods;
    if (!m) continue;
    own();
    if (m.radius)    c.radius = (c.radius || 0) + m.radius;
    if (m.range)     c.range  = (c.range  || 0) + m.range;
    if (m.chain)     c.chain  = (c.chain  || 0) + m.chain;
    if (m.count)     c.count  = (c.count  || 0) + m.count;
    if (m.repeat)    c.repeat = (c.repeat || 1) + m.repeat;
    if (m.pull)      c.pull = true;
    if (m.crit)      c.crit = true;
    if (m.lifesteal) c.lifesteal = (c.lifesteal || 0) + m.lifesteal;
    if (m.execute)   c.execute = Math.max(c.execute || 0, m.execute);
    if (m.detonate)  c.detonate = (c.detonate || 0) + m.detonate;
    if ((m.summonCount || m.ttl) && c.summon) {
      c.summon = Object.assign({}, c.summon);
      if (m.summonCount) c.summon.count = (c.summon.count || 1) + m.summonCount;
      if (m.ttl)         c.summon.ttl   = (c.summon.ttl   || 16) + m.ttl;
    }
    if ((m.statusDur || m.statusChance) && c.status) {
      c.status = Object.assign({}, c.status);
      if (m.statusDur)    c.status.dur    = (c.status.dur || 0) + m.statusDur;
      if (m.statusChance) c.status.chance = Math.min(1, (c.status.chance || 0) + m.statusChance);
    }
    if ((m.buffDur || m.buffMag) && c.buff) {
      const arr = (Array.isArray(c.buff) ? c.buff : [c.buff]).map(b => {
        const nb = Object.assign({}, b);
        if (m.buffDur) nb.dur = (nb.dur || 0) + m.buffDur;
        if (m.buffMag) nb.mag = +(nb.mag * (1 + m.buffMag)).toFixed(4);
        return nb;
      });
      c.buff = arr;
    }
    if (m.healMul && c.heal) {
      c.heal = Object.assign({}, c.heal);
      if (c.heal.flat)     c.heal.flat     = Math.round(c.heal.flat * (1 + m.healMul));
      if (c.heal.perLevel) c.heal.perLevel = +(c.heal.perLevel * (1 + m.healMul)).toFixed(3);
      if (c.heal.pctDmg)   c.heal.pctDmg   = +(c.heal.pctDmg * (1 + m.healMul)).toFixed(4);
    }
  }
  return c;
}

/**
 * Total recharge speed-up an active has earned from its milestones, as a fraction
 * (0.35 → recharges 35% faster). This is the per-archetype replacement for the old
 * blanket rank-7 "Honed" 20% cut: only the archetypes whose perks carry a `haste` mod
 * contribute, so a self-buff that trades recharge for duration reports 0 here.
 * @param {number} rank
 * @param {object|null} perks activeSurgePerks().perks
 * @returns {number} added fraction ≥ 0
 */
export function surgeHasteFrac(rank, perks) {
  if (!perks) return 0;
  let f = 0;
  for (const rk of reachedRanks(rank)) {
    const m = perks[rk] && perks[rk].mods;
    if (m && m.haste) f += m.haste;
  }
  return f;
}
