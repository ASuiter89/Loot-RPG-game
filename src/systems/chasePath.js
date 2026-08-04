// Chase pathfinding — the routine that walks a hunter AROUND an obstacle
// instead of into it.
//
// Every pursuing foe runs through here, from a single-tile vermin to a 3x3
// boss. The mover is a size x size body anchored at its top-left cell, so a
// wide boss only steps where its WHOLE bulk fits. That body-awareness is the
// point: bosses used to have no search at all — just a greedy "step toward the
// hero on one axis, then the other" — so a single rock on the one axis that
// mattered vetoed the move outright and the boss stood frozen behind it while
// the hero shot it for free.
//
// Pure: the caller hands in flat W*H grids and gets back a first step. Nothing
// here reads game state, the DOM or the clock.
//   blocked[y*W+x]  anything a body can't occupy this instant — walls, solid
//                   furniture, conjured barriers, other foes, the hero's tile
//   solid[y*W+x]    terrain + furniture only; used for the corner-cut test, so
//                   a body can't squeeze diagonally between two solid corners
//
// Two properties keep a chase from ever dead-ending:
//   * The search is a breadth-first flood over BODY PLACEMENTS, so it rounds
//     corners, threads gaps, and rejects squeezes the body can't make.
//   * When the hero is genuinely unreachable (sealed pocket, or a corridor too
//     narrow for a wide body) it does NOT give up — it returns a step toward
//     the reachable placement that gets CLOSEST to the hero, so a hunter always
//     presses in as far as the floor allows instead of stalling out of reach.

// Orthogonals first, then diagonals — the flood is breadth-first, so the order
// only decides which of several equally short routes wins.
const DIR_X = [1, -1, 0, 0, 1, 1, -1, -1];
const DIR_Y = [0, 0, 1, -1, 1, -1, 1, -1];

// Reused BFS scratch, stamped with a per-call generation so nothing needs
// clearing between calls (only the rare 16-bit stamp wrap does). One buffer set
// serves every foe: a chase is resolved fully inside a single call.
let _came = null, _seen = null, _queue = null, _gen = 0;

// Manhattan distance from the nearest cell of the body at (x, y) to (tx, ty).
// Clamping the target into the body's span gives that nearest cell directly.
export function bodyDist(x, y, size, tx, ty) {
  const last = size - 1;
  const nx = tx < x ? x : (tx > x + last ? x + last : tx);
  const ny = ty < y ? y : (ty > y + last ? y + last : ty);
  return Math.abs(nx - tx) + Math.abs(ny - ty);
}

// Does the whole body fit with its anchor at (x, y)? Cells the mover already
// stands on (its body at ox, oy) never block it — it vacates them as it steps.
export function bodyFits(W, H, blocked, x, y, size, ox, oy) {
  if (x < 0 || y < 0 || x + size > W || y + size > H) return false;
  for (let dy = 0; dy < size; dy++) {
    const cy = y + dy, row = cy * W;
    for (let dx = 0; dx < size; dx++) {
      const cx = x + dx;
      if (cx >= ox && cx < ox + size && cy >= oy && cy < oy + size) continue;
      if (blocked[row + cx]) return false;
    }
  }
  return true;
}

// Would the body at (x, y) overlap terrain or furniture? Off-map counts as
// solid, so a diagonal can never be squeezed around the edge of the world.
function bodySolid(W, H, solid, x, y, size) {
  if (x < 0 || y < 0 || x + size > W || y + size > H) return true;
  for (let dy = 0; dy < size; dy++) {
    const row = (y + dy) * W;
    for (let dx = 0; dx < size; dx++) if (solid[row + x + dx]) return true;
  }
  return false;
}

// First step of a shortest route that brings the body within `reach` tiles of
// (tx, ty). Returns [dx, dy], or null when the mover is already in position or
// has nowhere better to stand.
//
// `reach` 0 means "end ON the target tile" (how a single-tile foe closes for a
// melee swing — the hero's own tile is blocked, so it is allowed as a terminal
// square and the caller turns that step into an attack). `reach` 1 means "end
// beside it", which is how a multi-tile body closes: it can never stand where
// the hero stands.
export function chaseStep(W, H, blocked, solid, sx, sy, size, tx, ty, reach) {
  const n = W * H;
  if (n <= 0 || size < 1) return null;
  const startDist = bodyDist(sx, sy, size, tx, ty);
  if (startDist <= reach) return null;         // already in position — swing, don't shuffle
  if (!_came || _came.length !== n) {
    _came = new Int32Array(n); _seen = new Uint16Array(n); _queue = new Int32Array(n); _gen = 0;
  }
  const came = _came, seen = _seen, queue = _queue;
  // The stamps live in a Uint16Array, so the generation must wrap at the STORAGE
  // width: once it outgrows 16 bits every `seen[ni] === gen` compare goes false
  // forever, dedupe dies, and the fixed-size queue overflows.
  if (++_gen > 0xffff) { seen.fill(0); _gen = 1; }
  const gen = _gen;
  const start = sy * W + sx;
  came[start] = -1; seen[start] = gen;
  queue[0] = start;
  // Each cell is enqueued at most once (the `seen` guard), so W*H slots always
  // suffice and the flood terminates without a separate step cap.
  let qi = 0, qt = 1, goal = -1;
  // Best consolation placement: the closest square the body can actually reach.
  // Only a STRICT improvement counts, and the flood is FIFO, so the shallowest
  // placement at a given distance wins — no detour to an equally-close tile.
  let best = -1, bestDist = startDist;
  while (qi < qt) {
    const cur = queue[qi++];
    const cx = cur % W, cy = (cur - cx) / W;
    for (let d = 0; d < 8; d++) {
      const dx = DIR_X[d], dy = DIR_Y[d];
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx + size > W || ny + size > H) continue;
      const ni = ny * W + nx;
      if (seen[ni] === gen) continue;
      const dist = bodyDist(nx, ny, size, tx, ty);
      // Only a reach-0 chase ends ON the target, and only there may the body
      // land on a blocked square (the hero's own tile).
      const terminal = reach === 0 && dist === 0;
      if (!terminal && !bodyFits(W, H, blocked, nx, ny, size, sx, sy)) continue;
      if (dx !== 0 && dy !== 0 &&
          bodySolid(W, H, solid, nx, cy, size) && bodySolid(W, H, solid, cx, ny, size)) continue;
      came[ni] = cur; seen[ni] = gen;
      if (dist <= reach) { goal = ni; qi = qt; break; }
      if (dist < bestDist) { bestDist = dist; best = ni; }
      queue[qt++] = ni;
    }
  }
  const end = goal >= 0 ? goal : best;
  if (end < 0) return null;                    // boxed in with nothing closer to move to
  // Walk the parent chain back to the square adjacent to the start. Bounded by
  // the grid; the guard is a backstop against a malformed chain, not a real path.
  let cur = end, hops = 0;
  while (came[cur] !== start) { cur = came[cur]; if (cur < 0 || ++hops > n) return null; }
  const fx = cur % W, fy = (cur - fx) / W;
  return [fx - sx, fy - sy];
}
