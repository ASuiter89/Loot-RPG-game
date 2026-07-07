// Cycle headline-rule resolvers — pure functions the shell reads to APPLY a season's
// twist. The table (src/data/cycleModifiers.js) is just knob values; these turn a
// resolved knob into an applied number/array at the relevant call site. No globals, no
// RNG, no DOM, no clock — plain values in, plain values out.
//
// Flow in the legacy shell:
//   const p = resolveModifier(cycle.headlineModifierId);   // normalized params
//   weights = applyLootTierShift(baseWeights, p.lootTierShift);  // in the loot roll
//   gold    = applyPayoutMult(baseGold, p.bountyPayoutMult);     // in bounty/journey payout
//   count   = applyDensityMult(baseCount, p.densityMult);        // in floor build
//   xp      = applyXpMult(baseXp, p.xpMult);                     // in the xp grant
//   affix   = p.enemyAffix;                                      // stamped on each spawn
import { CYCLE_MODIFIERS } from '../data/cycleModifiers.js';

// The neutral, all-default params. resolveModifier merges a found row over this, so an
// unknown/missing id (or a row that only sets one knob) always yields a complete,
// safe-to-read shape — the shell never has to null-check individual knobs.
const NEUTRAL = {
  lootTierShift: 0,
  bountyPayoutMult: 1,
  enemyAffix: null,
  densityMult: 1,
  xpMult: 1,
};

// A finite-number coercion with a fallback — keeps a garbage tuning value (NaN, a
// string, undefined) from poisoning a multiplier.
function num(v, fallback) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

// Resolve a headline-rule id to its NORMALIZED params (every knob present, defaults
// filled). An unknown id, null, or a table with no match ⇒ the neutral shape (no
// change). Never returns the live data object — always a fresh merge — so a caller
// can't accidentally mutate the shared table.
export function resolveModifier(id, data = CYCLE_MODIFIERS) {
  const list = Array.isArray(data) ? data : [];
  let found = null;
  if (id) {
    for (const m of list) {
      if (m && m.id === id) { found = m; break; }
    }
  }
  const p = (found && found.params) || {};
  return {
    lootTierShift: Math.trunc(num(p.lootTierShift, NEUTRAL.lootTierShift)),
    bountyPayoutMult: num(p.bountyPayoutMult, NEUTRAL.bountyPayoutMult),
    enemyAffix: (typeof p.enemyAffix === 'string' && p.enemyAffix) ? p.enemyAffix : NEUTRAL.enemyAffix,
    densityMult: num(p.densityMult, NEUTRAL.densityMult),
    xpMult: num(p.xpMult, NEUTRAL.xpMult),
  };
}

// Convenience: the enemy affix a season stamps on every spawn (or null). Just reads the
// resolved params, but named for the spawn call site.
export function modifierEnemyAffix(id, data = CYCLE_MODIFIERS) {
  return resolveModifier(id, data).enemyAffix;
}

// Shift a loot tier-WEIGHT array up (+) or down (−) N tiers. `baseWeights` is the
// per-tier probability weight array (index 0 = lowest rarity … last = highest, e.g.
// junk→red). A +1 shift moves each tier's weight one slot toward higher rarity; weight
// that would fall off either END piles onto the boundary tier (so total weight is
// conserved and the drop table never loses mass). shift 0 (or a non-integer that
// truncates to 0) returns a copy unchanged. A non-array ⇒ [].
export function applyLootTierShift(baseWeights, shift) {
  if (!Array.isArray(baseWeights)) return [];
  const n = baseWeights.length;
  const s = Math.trunc(num(shift, 0));
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const w = num(baseWeights[i], 0);
    // Destination tier, clamped to [0, n-1] so overflow/underflow accumulates at the
    // boundary rather than vanishing.
    const dst = Math.min(n - 1, Math.max(0, i + s));
    out[dst] += w;
  }
  return out;
}

// Multiply a base bounty/journey gold payout by the season's payout multiplier. Clamps
// the multiplier to ≥ 0 (a season never pays negative gold) and floors the result to a
// whole coin. A non-finite base ⇒ 0.
export function applyPayoutMult(baseGold, mult) {
  const base = num(baseGold, 0);
  const m = Math.max(0, num(mult, 1));
  return Math.floor(Math.max(0, base) * m);
}

// Multiply a base per-floor spawn COUNT by the season's density multiplier. Rounds to a
// whole number of monsters and clamps to ≥ 0. A non-finite base ⇒ 0.
export function applyDensityMult(baseCount, mult) {
  const base = num(baseCount, 0);
  const m = Math.max(0, num(mult, 1));
  return Math.max(0, Math.round(Math.max(0, base) * m));
}

// Multiply a base XP grant by the season's XP multiplier. Clamps the multiplier to ≥ 0
// and floors to whole XP. A non-finite base ⇒ 0.
export function applyXpMult(baseXp, mult) {
  const base = num(baseXp, 0);
  const m = Math.max(0, num(mult, 1));
  return Math.floor(Math.max(0, base) * m);
}
