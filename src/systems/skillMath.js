// Pure skill-progression math — rank scaling, milestone power spikes, and mana
// cost. Deterministic: primitives in, numbers out, no globals. Extracted verbatim
// from the monolith (see docs/CHANGELOG.md).

// Mana-cost dials live in src/data/skillCosts.js beside the blood-cost tuning — one
// file to open when casting feels starved. (They used to be module-locals here.)
import { SKILL_MP_MULT, MANA_PER_RANK } from '../data/skillCosts.js';

// Every base-tree passive maxes at this rank; reaching it unlocks the node's
// one-off "surge" (a new stat, see data/passiveSurges.js). Keystones max at 1,
// so they never surge.
export const PASSIVE_MAX_RANK = 10;

/**
 * Is a passive's max-rank "surge" bonus live? True once the node is at (or past)
 * its max rank. `maxRank` defaults to the base-tree cap; pass a node's own `max`
 * so single-rank keystones (max 1) are handled correctly.
 */
export function passiveSurgeLive(rank, maxRank = PASSIVE_MAX_RANK) {
  return (rank || 0) >= (maxRank || PASSIVE_MAX_RANK);
}

/**
 * Flat power spikes granted at milestone ranks (3, 7, 10), summed.
 * @returns {number} bonus fraction (0 below rank 3, up to 0.78 at rank 10+).
 */
export function milestonePower(rank) {
  let b = 0;
  if (rank >= 3) b += 0.28;
  if (rank >= 7) b += 0.20;
  if (rank >= 10) b += 0.30;
  return b;
}

/**
 * Skill magnitude multiplier for a given rank: ~12% per rank plus milestone
 * spikes. Rank 0/1 both scale as rank 1.
 */
export function rankScale(rank) {
  return (1 + 0.12 * ((rank || 1) - 1)) * (1 + milestonePower(rank));
}

/**
 * Passive milestone surge. Pouring points into ONE passive pays off in jumps too:
 * at the same milestone ranks the actives spike (3, 7, 10) a passive's always-on
 * bonus surges. Gentler than the active spikes (milestonePower) because passives
 * are always on and stack across a whole tree. Cumulative bonus fraction applied
 * on top of the linear per-rank total: 0 below rank 3, up to 0.30 at rank 10+.
 * Keystones cap at rank 1, so they never reach a milestone.
 */
export function passiveMilestonePower(rank) {
  let b = 0;
  if (rank >= 3) b += 0.08;
  if (rank >= 7) b += 0.10;
  if (rank >= 10) b += 0.12;
  return b;
}

/**
 * Multiplier a passive's summed fx/cfx bonus takes at a given rank — 1 plus its
 * milestone surge. Ranks 0–2 scale as 1.0 (no surge yet).
 */
export function passiveRankScale(rank) {
  return 1 + passiveMilestonePower(rank || 0);
}

/**
 * A skill node's own MP cost at a given rank, BEFORE gear Mana Cost Reduction.
 * Cost only climbs with rank. Rank 0 previews the rank-1 cost. Nodes with no
 * `mp` cost 0.
 */
export function skillManaCost(node, rank) {
  if (!node || !node.mp) return 0;
  const r = Math.max(1, rank || 1);
  return Math.max(1, Math.round(node.mp * SKILL_MP_MULT * (1 + MANA_PER_RANK * (r - 1))));
}

// ── Skill-point economy ──────────────────────────────────────────────────────
// Two separate pools. NORMAL skill points fund the passive + active trees: one
// per level, none handed out at creation — a fresh hero EARNS their first point
// by reaching level 2 (the beach-tutorial clear grants that level, so a new hero
// spends their first point right after learning to fight, not for free at spawn).
// ASCENDANCY points fund only the ascendancy "path" tree: one every
// ASC_POINT_EVERY levels, starting at ASCEND_LEVEL — the level at which a hero
// can first ascend. The pools are earned and spent independently, so normal
// points can never buy path skills and vice-versa.
export const SKILL_POINTS_PER_LEVEL = 1;
export const SKILL_POINTS_AT_START = 0;
export const ASCEND_LEVEL = 20; // level at which the Trainer offers ascension
export const ASC_POINT_EVERY = 5; // one ascendancy point per this many levels

/**
 * Total NORMAL skill points a hero of the given level has earned over its
 * lifetime (one per level above the first; none at creation). Used to grant the
 * right pool on a new game and to reconcile older saves on load. (Older saves
 * only ever gain points here — the reconciliation never removes any — so a
 * veteran who banked the old starting point keeps it.)
 */
export function earnedSkillPoints(level) {
  return SKILL_POINTS_AT_START + Math.max(0, (level || 1) - 1) * SKILL_POINTS_PER_LEVEL;
}

/**
 * Total ASCENDANCY points a hero of the given level has earned: none before
 * ASCEND_LEVEL, then one at ASCEND_LEVEL and one more every ASC_POINT_EVERY
 * levels after (20, 25, 30, …). Points accrue from level 20 whether or not the
 * hero has actually ascended yet — they simply can't be spent until it has.
 */
export function earnedAscPoints(level) {
  const lv = level || 1;
  if (lv < ASCEND_LEVEL) return 0;
  return Math.floor((lv - ASCEND_LEVEL) / ASC_POINT_EVERY) + 1;
}
