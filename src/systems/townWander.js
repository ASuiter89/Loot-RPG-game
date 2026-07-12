// Pure helpers for the town's strolling keepers — no DOM, no globals, no clock; the
// RNG is injected so every function is deterministic and unit-testable. The
// per-frame movement + drawing that consumes these lives in the coverage-excluded
// src/legacy/game.js (buildTown / updateTownNpcs / drawTownWorld), per the input rule.

// Pick `n` DISTINCT tiles at random from `freeTiles` (an array of {x,y}). Used to
// scatter the regular keepers to fresh spots on every town visit. A partial
// Fisher–Yates shuffle keyed off the injected rng — deterministic for a seeded
// stream, and it never returns the same tile twice. Returns fewer than `n` only
// when the pool is smaller than `n`.
export function randomDistinctTiles(freeTiles, n, rng) {
  const pool = freeTiles.slice();
  const take = Math.max(0, Math.min(n, pool.length));
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  return pool.slice(0, take);
}

// The walkable orthogonal neighbours of `cur` that stay within Chebyshev `radius`
// of `home` (so a keeper drifts around its own patch, never across the whole camp).
// `isFree(x,y)` reports whether a tile is a legal wander tile (interior, off decor,
// outside the sanctum). Diagonal-free so a stroll never clips a wall corner.
export function wanderNeighbors(cur, home, radius, isFree) {
  const out = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const nx = cur.x + dx, ny = cur.y + dy;
    if (Math.abs(nx - home.x) > radius || Math.abs(ny - home.y) > radius) continue;
    if (!isFree(nx, ny)) continue;
    out.push({ x: nx, y: ny });
  }
  return out;
}

// Choose the keeper's next step (an adjacent walkable tile within its patch), or
// null when it's boxed in and should simply wait. Deterministic for a seeded rng.
export function pickWanderTarget(cur, home, radius, isFree, rng) {
  const opts = wanderNeighbors(cur, home, radius, isFree);
  if (!opts.length) return null;
  return opts[Math.floor(rng() * opts.length)];
}

// Format a list of names with an Oxford-free "A, B & C" join for the arrivals banner
// ("Vault, Merchant & Healer"). One name returns itself; two join with " & ".
export function joinNames(names) {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return list[0] + ' & ' + list[1];
  return list.slice(0, -1).join(', ') + ' & ' + list[list.length - 1];
}
