// Pure skill-progression math — rank scaling, milestone power spikes, and mana
// cost. Deterministic: primitives in, numbers out, no globals. Extracted verbatim
// from the monolith (see docs/CHANGELOG.md).

const MANA_PER_RANK = 0.08; // +8% of base mana per rank above the first
const SKILL_MP_MULT = 1.5;  // global mana-cost multiplier (mana is rationed — spells cost more)

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
 * A skill node's own MP cost at a given rank, BEFORE gear Mana Cost Reduction.
 * Cost only climbs with rank. Rank 0 previews the rank-1 cost. Nodes with no
 * `mp` cost 0.
 */
export function skillManaCost(node, rank) {
  if (!node || !node.mp) return 0;
  const r = Math.max(1, rank || 1);
  return Math.max(1, Math.round(node.mp * SKILL_MP_MULT * (1 + MANA_PER_RANK * (r - 1))));
}
