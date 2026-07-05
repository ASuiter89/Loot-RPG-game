// Foot reachability + path-repair primitives for the map builder.
//
// A floor is carved so its terrain is fully connected, but stationary objects
// dropped in afterwards — solid decor/furniture and the two shop NPCs — can each
// seal a stretch of floor if placed carelessly. These pure helpers let the builder
// (1) find any tile the bare terrain reaches but an object walls off, and (2) route
// back to open ground so the offending object can be cleared. No game state: the
// caller supplies grid predicates.
//
// Both functions model FOOT movement with terminal tiles: a tile can be
// `enterable` (you may step onto it) yet not `walkThrough` (you may not step back
// off — stairs and teleporter pads whisk you away). The start tile is always
// expanded even when terminal, since the hero already stands on it.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Flood-fill the "y,x" tiles reachable on foot from (sx, sy).
//   enterable(x, y)   → the hero can step ONTO this tile
//   walkThrough(x, y) → …and step back OFF it again (terminal tiles are excluded)
export function footReach(W, H, sx, sy, enterable, walkThrough) {
  const seen = new Set([sy + ',' + sx]);
  const stack = [[sx, sy]];
  const cap = W * H * 4;
  let guard = 0;
  while (stack.length && guard++ < cap) {
    const [x, y] = stack.pop();
    const isStart = x === sx && y === sy;
    if (!isStart && !walkThrough(x, y)) continue;   // terminal tile: reached, not passed through
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny + ',' + nx;
      if (seen.has(k) || !enterable(nx, ny)) continue;
      seen.add(k); stack.push([nx, ny]);
    }
  }
  return seen;
}

// Find the first EMPTY floor tile that the bare terrain reaches but the object-
// augmented connectivity does NOT — i.e. an open tile a stationary object walled
// off. `enter`/`through` are the terrain predicates (as for footReach);
// `objectSolid(x, y)` marks a tile a stationary object blocks. Returns
// { stranded: [x, y] | null, objReach: Set } — objReach (reachability WITH the
// objects solid) is handed back so the caller can route the strand back to it.
//
// A tile an object SITS on is terrain-reachable yet never object-reachable (you
// can't stand where the object is); that is BY DESIGN, not a strand, so such tiles
// are skipped. A real strand is EMPTY floor sealed off BEHIND an object.
export function firstStrandedTile(W, H, sx, sy, enter, through, objectSolid) {
  const objReach = footReach(W, H, sx, sy,
    (x, y) => enter(x, y) && !objectSolid(x, y),
    (x, y) => through(x, y) && !objectSolid(x, y));
  const terrainReach = footReach(W, H, sx, sy, enter, through);
  let stranded = null;
  for (const key of terrainReach) {
    if (objReach.has(key)) continue;
    const c = key.indexOf(','); const y = +key.slice(0, c), x = +key.slice(c + 1);
    if (through(x, y) && !objectSolid(x, y)) { stranded = [x, y]; break; }
  }
  return { stranded, objReach };
}

// Breadth-first SHORTEST path from (sx, sy) to the nearest tile satisfying
// `inTarget`, stepping only through tiles where `step(x, y)` holds (the start is
// always expandable, and a target tile is an acceptable endpoint even if `step` is
// false there). Returns the path as [[x, y], …] from start to target inclusive, or
// null when no target tile is reachable. Used to route a stranded pocket back to
// open ground: the caller then clears whatever objects sit on the returned tiles.
export function pathToRegion(W, H, sx, sy, step, inTarget) {
  if (inTarget(sx, sy)) return [[sx, sy]];
  const prev = new Map([[sy + ',' + sx, null]]);
  const q = [[sx, sy]];
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny + ',' + nx;
      if (prev.has(k)) continue;
      const target = inTarget(nx, ny);
      if (!target && !step(nx, ny)) continue;
      prev.set(k, [x, y]);
      if (target) {
        const path = [];
        for (let cur = [nx, ny]; cur; cur = prev.get(cur[1] + ',' + cur[0])) path.push(cur);
        return path.reverse();
      }
      q.push([nx, ny]);
    }
  }
  return null;
}
