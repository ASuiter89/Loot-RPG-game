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

// Would a solid multi-tile piece land in genuine OPEN ROOM space?
//
// footprintSealsPath only rejects a placement that DISCONNECTS the floor. A wide
// piece can still plug a corridor or a doorway that a detour keeps connected — a
// bed dropped across a hall you then can't walk down. Built interiors are laid out
// as separate room rectangles joined by corridors, so the clean rule is: the whole
// footprint must sit strictly INSIDE one room, inset one tile from that room's
// edge. Inset by one keeps the piece off the room's perimeter — where doorways
// open onto corridors — so it can never bridge a passage, while still allowing it
// snug in a corner (a corner tile's neighbours are all interior/edge floor).
//
//   footprint  array of [x, y] tiles the piece would occupy
//   rooms      array of { x, y, w, h } room rectangles (floorRooms)
export function footprintInsideRoom(footprint, rooms) {
  if (!footprint.length || !rooms || !rooms.length) return false;
  return rooms.some((r) => footprint.every(
    ([x, y]) => x > r.x && x < r.x + r.w - 1 && y > r.y && y < r.y + r.h - 1));
}

// Is (x, y) a genuine 1-wide THROUGH-CORRIDOR tile — a straight hall that a single
// impassable object would FULLY plug?
//
// True only when the tile is walkable on two OPPOSITE sides and blocked on the
// other (perpendicular) pair: a hall you walk straight through, one tile wide. A
// corner (walkable on two ADJACENT sides), a 2-wide corridor tile (walkable on 3
// sides — the parallel lane stays open), a room tile (3–4) and a dead-end (1) are
// all NOT through-corridors: an object on any of them still leaves a way past.
//
// This is the "bed in the hallway" case #509 fixed for interior furniture, stated
// generally: an object here blocks that hall even when a longer detour keeps the
// whole floor connected — so a plain disconnection/reachability test (which only
// flags a tile it can no longer REACH) never catches it. Callers use it to keep any
// impassable object (solid decor/furniture AND shop NPCs, indoor or outdoor) off
// such tiles.
//
// Pure: the caller supplies `isWalkable(x, y)` → true for an in-bounds tile the hero
// can walk through (so a passable perpendicular neighbour — water, a parallel lane —
// correctly means the tile is not really 1-wide). Out-of-bounds reads as blocked.
//
//   x, y        the floor tile to classify
//   W, H        map dimensions (bounds the neighbour reads)
//   isWalkable  (x, y) → boolean
export function isThroughCorridor(x, y, W, H, isWalkable) {
  const open = (nx, ny) => nx >= 0 && ny >= 0 && nx < W && ny < H && isWalkable(nx, ny);
  const N = open(x, y - 1), S = open(x, y + 1), E = open(x + 1, y), Wn = open(x - 1, y);
  return (N && S && !E && !Wn) || (E && Wn && !N && !S);
}
