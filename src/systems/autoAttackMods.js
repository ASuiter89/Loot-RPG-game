// ── AUTO-ATTACK MODIFIER MATH ────────────────────────────────────────────────
// WHO an auto-attack's extra hits land on, and for how much. Pure: tiles and foe
// lists in, foe lists and damage fractions out. Line of sight is INJECTED as a
// predicate (`hasLos(ax, ay, bx, by)`), the way src/systems/aoeTargeting.js does it,
// so the real raycast can stay at the edge in src/legacy/game.js and every rule here
// stays deterministic and unit-testable.
//
// All tuning lives in src/data/autoAttackMods.js; this module only applies it.

import {
  AUTO_MOD_KEYS, AUTO_MOD_INFO, AUTO_MOD_CAPS, AUTO_MOD_TUNING, AUTO_MOD_BOUNCE,
  AUTO_MOD_NODES,
} from '../data/autoAttackMods.js';
import { nextChainLink } from './aoeTargeting.js';

/** The hard ceiling on a modifier's extra hits (0 for an unknown key). */
export function autoModCap(kind) {
  return AUTO_MOD_CAPS[kind] || 0;
}

/**
 * Fold a raw, uncapped tally of granted modifiers into the shape combat reads:
 * every key clamped to its cap, plus an `any` flag so the whole modifier block can
 * be skipped in one test on the (very common) no-modifier build.
 *
 * A REBOUND with no ricochet to bend would do nothing at all, so bounce implies one
 * ricochet — "a rebounding shot always caroms at least once".
 * @param {object} raw tally like { pierce: 2, bounce: 1 }
 * @returns {{pierce:number,ricochet:number,multishot:number,bounce:number,any:boolean}}
 */
export function clampAutoMods(raw) {
  const out = {};
  for (const k of AUTO_MOD_KEYS) {
    const n = Math.floor(Math.max(0, (raw && raw[k]) || 0));
    out[k] = Math.min(n, autoModCap(k));
  }
  if (out.bounce > 0 && out.ricochet < 1) out.ricochet = 1;
  out.any = AUTO_MOD_KEYS.some(k => out[k] > 0);
  return out;
}

/**
 * The fraction of the swing's damage the `hop`-th EXTRA hit of a kind deals
 * (hop is 1-based). Each hop taper-multiplies the last, so extra hits always shrink
 * and a long chain can never out-damage the blow that started it. 0 for a kind that
 * deals no damage of its own (bounce) or an unknown key.
 * @param {string} kind 'pierce' | 'ricochet' | 'multishot'
 * @param {number} hop 1-based index among that kind's extra hits
 * @returns {number}
 */
export function autoModMult(kind, hop) {
  const t = AUTO_MOD_TUNING[kind];
  if (!t || !(hop >= 1)) return 0;
  return t.first * Math.pow(t.falloff, hop - 1);
}

/**
 * What a class passive grants the auto-attack at a given rank — null until the node
 * reaches its threshold (see AUTO_MOD_NODES). Mirrors the passive-surge pattern: the
 * grant is a flat unlock at a rank, not a per-rank trickle, so a modifier either
 * exists or it doesn't.
 * @param {string} nodeId skill-node id
 * @param {number} rank ranks currently bought in that node
 * @returns {object|null} grant tally like { pierce: 1 }
 */
export function nodeAutoMod(nodeId, rank) {
  const e = AUTO_MOD_NODES[nodeId];
  if (!e || !(rank >= e.at)) return null;
  return e.grant;
}

/**
 * Sum every passive grant a hero's learned ranks earn.
 * @param {object} ranks map of node id → rank (the hero's player.skills)
 * @returns {object} raw (uncapped) tally — feed it to clampAutoMods
 */
export function sumNodeAutoMods(ranks) {
  const raw = {};
  for (const id in (ranks || {})) {
    const grant = nodeAutoMod(id, ranks[id]);
    if (!grant) continue;
    for (const k in grant) raw[k] = (raw[k] || 0) + grant[k];
  }
  return raw;
}

/**
 * The foes a PIERCING blow carries on into: those standing on the same line the
 * swing already travelled (hero → struck foe), BEYOND the struck foe and within the
 * shot's remaining travel, ordered nearest-first so damage tapers outward.
 *
 * "On the line" is judged by perpendicular offset rather than exact tiles, so a foe
 * a hair off the ray still gets skewered and one standing a tile aside does not.
 * @param {{x:number,y:number}} hero the swinging hero's tile
 * @param {{x:number,y:number}} target the foe actually struck
 * @param {Array<{x:number,y:number}>} foes other living foes
 * @param {number} count how many extra foes may be hit
 * @param {number} [reach] tiles of travel past the struck foe
 * @param {number} [halfWidth] max perpendicular offset from the line
 * @returns {Array} the pierced foes, nearest-first
 */
export function pierceTargets(hero, target, foes, count, reach, halfWidth) {
  if (!hero || !target || target.x == null || !(count > 0)) return [];
  const t = AUTO_MOD_TUNING.pierce;
  const far = reach == null ? t.reach : reach;
  const wide = halfWidth == null ? t.halfWidth : halfWidth;
  const dx = target.x - hero.x, dy = target.y - hero.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return [];          // struck a foe on your own tile — no line to follow
  const ux = dx / len, uy = dy / len;
  const found = [];
  for (const f of (foes || [])) {
    if (!f || f === target || f.x == null) continue;
    const px = f.x - hero.x, py = f.y - hero.y;
    const along = px * ux + py * uy;                 // distance down the shot's line
    if (along <= len || along > len + far) continue; // behind the mark, or out of travel
    if (Math.abs(px * uy - py * ux) > wide) continue; // too far off the line
    found.push({ f, along });
  }
  found.sort((a, b) => a.along - b.along);
  return found.slice(0, count).map(o => o.f);
}

/**
 * The chain a RICOCHETING blow carves: each hop leaps from the LAST foe struck to
 * the nearest unhit foe within reach that it can see — the same rule chain lightning
 * uses, so a carom can bend around a corner the hero cannot see past.
 *
 * With `bounce`, the shot is caroming off the walls themselves: hops reach farther
 * (AUTO_MOD_BOUNCE.hopBonus) and no longer need line of sight, so a rebounding shot
 * can find a foe tucked behind cover.
 * @param {{x:number,y:number}} from the foe the chain starts at (already struck)
 * @param {Array<{x:number,y:number}>} foes other living foes
 * @param {number} hops how many extra foes the chain may reach
 * @param {(ax:number,ay:number,bx:number,by:number)=>boolean} hasLos LOS predicate
 * @param {boolean} [bounce] may the shot carom off walls?
 * @returns {Array} the chained foes, in hop order
 */
export function ricochetChain(from, foes, hops, hasLos, bounce) {
  const out = [];
  if (!from || from.x == null || !(hops > 0)) return out;
  const step = AUTO_MOD_TUNING.ricochet.hop + (bounce ? AUTO_MOD_BOUNCE.hopBonus : 0);
  // A caromed shot travels off the stone, so it needs no clear line to its next mark.
  const los = bounce ? () => true : hasLos;
  if (typeof los !== 'function') return out;
  const pool = (foes || []).filter(f => f && f !== from && f.x != null);
  let last = from;
  for (let i = 0; i < hops; i++) {
    const next = nextChainLink(last, pool, step, los);
    if (!next) break;
    out.push(next);
    pool.splice(pool.indexOf(next), 1);   // never strike the same foe twice in one chain
    last = next;
  }
  return out;
}

/**
 * The other foes a MULTISHOT's extra strikes go out at: the nearest living foes
 * within weapon reach that the hero can see, excluding whoever the main swing already
 * hit. Nearest-first, so the falloff lands on the furthest extra strike.
 * @param {{x:number,y:number}} hero the hero's tile
 * @param {Array<{x:number,y:number}>} foes other living foes (main target excluded)
 * @param {number} count how many extra strikes go out
 * @param {number} range the weapon's reach in tiles
 * @param {(foe:object)=>boolean} canSee predicate — can the hero see this foe?
 * @returns {Array} the extra foes, nearest-first
 */
export function multishotTargets(hero, foes, count, range, canSee) {
  if (!hero || !(count > 0) || !(range > 0)) return [];
  const found = [];
  for (const f of (foes || [])) {
    if (!f || f.x == null) continue;
    const d = Math.hypot(f.x - hero.x, f.y - hero.y);
    if (d > range) continue;
    if (typeof canSee === 'function' && !canSee(f)) continue;
    found.push({ f, d });
  }
  found.sort((a, b) => a.d - b.d);
  return found.slice(0, count).map(o => o.f);
}

/**
 * A short human-readable summary of a hero's active modifiers ("Pierce 2 · Ricochet 1
 * · Rebound"), for the hero sheet, item cards and the console API. Bounce carries no
 * count — you either carom off walls or you don't. Empty string when nothing is on.
 * @param {object} mods a clamped modifier set
 * @returns {string}
 */
export function describeAutoMods(mods) {
  if (!mods) return '';
  const parts = [];
  for (const k of AUTO_MOD_KEYS) {
    const n = mods[k] || 0;
    if (n <= 0) continue;
    const label = (AUTO_MOD_INFO[k] || {}).label || k;
    parts.push(k === 'bounce' ? label : `${label} ${n}`);
  }
  return parts.join(' · ');
}
