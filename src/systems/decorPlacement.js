// Placement guard for a multi-tile SOLID decor object (a table, sofa, bed…).
//
// Solid decor is written into the collision map, so every tile of its footprint
// becomes a wall. Checking only the anchor tile — "is the tile I dropped it on in
// open space?" — misses the far tiles: a 2-wide table can sit with its anchor in a
// room while its other half plugs a 2-wide corridor and walls off the stairs.
//
// This is the real test: would turning the whole footprint into walls cut the floor
// in two? It's a LOCAL reachability check. Collect the open-floor tiles the footprint
// borders (its "exits"), flood-fill from one of them treating the footprint as solid,
// and confirm every other exit is still reachable. If one isn't, the two sides were
// only joined THROUGH the footprint, so placing the piece would seal a path — the
// caller should reject the spot and try elsewhere.
//
// Pure: no game state. The caller supplies `isWalkable(x, y)` — true for an in-bounds
// floor tile that isn't already solid (wall / other furniture). The footprint itself
// is excluded internally, so the predicate need not know about the candidate piece.
//
//   footprint  array of [x, y] tiles the piece would make solid
//   W, H       map dimensions in tiles (bounds the flood-fill guard)
//   isWalkable (x, y) → boolean: an in-bounds floor tile you could stand on today
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// True when (x, y) sits inside a fully-open 2x2 block of walkable floor — i.e. it
// is genuine open ground, not a 1-tile-wide corridor, a junction of them, or a
// path end. A solid obstacle (tree/rock/furniture) dropped here can never plug a
// narrow passage: an open 2x2 always leaves a side-step around the piece. The
// anchor-only "3+ open orthogonal neighbours" test is NOT enough — a corridor
// junction or path mouth has 3-4 open neighbours yet is still 1 tile wide, so an
// obstacle there blocks the way even when a detour exists. `isWalkable(x, y)` is
// true for an in-bounds floor tile you could stand on today (not a wall / existing
// solid decor).
export function inOpenArea(x, y, isWalkable) {
  // The four 2x2 quads that include (x, y) — anchor at each of the quad's corners.
  const quads = [[0, 0], [-1, 0], [0, -1], [-1, -1]];
  for (const [ox, oy] of quads) {
    const qx = x + ox, qy = y + oy;
    if (isWalkable(qx, qy) && isWalkable(qx + 1, qy)
      && isWalkable(qx, qy + 1) && isWalkable(qx + 1, qy + 1)) return true;
  }
  return false;
}

export function footprintSealsPath(footprint, W, H, isWalkable) {
  const inFoot = new Set(footprint.map(([x, y]) => x + ',' + y));
  const open = (x, y) => !inFoot.has(x + ',' + y) && isWalkable(x, y);
  // The open-floor tiles orthogonally touching the footprint — the exits it borders.
  const exits = [];
  const seenExit = new Set();
  for (const [fx, fy] of footprint) {
    for (const [dx, dy] of DIRS) {
      const nx = fx + dx, ny = fy + dy, k = nx + ',' + ny;
      if (!seenExit.has(k) && open(nx, ny)) { seenExit.add(k); exits.push([nx, ny]); }
    }
  }
  if (exits.length < 2) return false;   // ≤1 exit → nothing on a far side to strand
  // Flood from the first exit; if the fill can't reach every other exit, the
  // footprint is the only thing that joined them → it would split the floor.
  const seen = new Set([exits[0][0] + ',' + exits[0][1]]);
  const stack = [exits[0]];
  const cap = W * H * 4;
  let guard = 0;
  while (stack.length && guard++ < cap) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !open(nx, ny)) continue;
      seen.add(k); stack.push([nx, ny]);
    }
  }
  return exits.some(([x, y]) => !seen.has(x + ',' + y));
}
