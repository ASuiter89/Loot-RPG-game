// How a hand-crafted unique (or Pantheon Mythic) rolls its signature powers when it
// drops. Pure: numbers/keys in, keys out — no globals, no DOM, RNG injected.
//
// A unique authors a two-entry `powers` pool: [0] its PRIMARY signature power, [1]
// its SECONDARY. On drop the piece always takes the primary; it takes the secondary
// too only on the ~33% of drops that pass the UNIQUE_SECOND_POWER_CHANCE roll — so a
// unique carries 1 power ~67% of the time and 2 ~33% of the time, never 3. The result
// is stamped onto item.powers once (buildFixedArtifact) and then locks like every
// other rolled value.
import { UNIQUE_SECOND_POWER_CHANCE } from '../data/uniques.js';

// The signature powers a freshly-dropped unique carries. `pool` is the authored
// `powers` array (primary first). `rng` returns [0,1); production passes Math.random,
// tests pass a deterministic stream. Returns a fresh array of 1 or 2 keys (never
// mutates the pool). A single-entry or empty pool can only ever yield that one (or
// none) — the second-power roll is skipped when there is no secondary to grant.
export function rollUniquePowers(pool, rng = Math.random, chance = UNIQUE_SECOND_POWER_CHANCE) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const chosen = [pool[0]];
  if (pool.length > 1 && rng() < chance) chosen.push(pool[1]);
  return chosen;
}
