// Boss-arena geometry — turns the per-guardian layouts in `src/data/bossArenas.js`
// into a concrete tile grid, with a built-in navigability safety net. Pure and
// deterministic (no rng, no DOM); the legacy monolith carves the circle by calling
// `carveArenaGrid` and stamps the result into `mapData`.
//
// Every arena is a stone circle of radius ARENA_R. Three regions are ALWAYS kept
// open, whatever the layout asks for, so a guardian (up to 3×3) can never be boxed
// in and the hero can always reach the exit:
//   • the central PLAZA (Chebyshev ≤ ARENA_PLAZA_CHEB) — the guardian's ground,
//   • the north-south LANE (|dx| ≤ ARENA_LANE_HALF) — entrance stair ↔ exit stair,
//   • the perimeter RING (the outermost ARENA_RING_TILES tiles) — a lap lane.
// Cover and hazards live in the annulus between plaza and ring. `arenaNavIssues`
// re-derives the grid and flood-fills it to prove the invariant; the systems test
// runs it on all fifteen layouts.
//
// Every one of those widths is sized so a 3×3 guardian has SLACK, not a single
// thread of legal footprint: a lane it can only cross one tile at a time reads in
// play as the boss wedging itself on a pillar (it lumbers greedily, it does not
// path). So the ring is measured in TILES of open floor rather than as a fraction
// of R — a fraction thins to a needle at the diagonals, which is exactly where the
// corner cover sits — and `arenaNavIssues` fails any layout whose roaming area has
// a one-anchor bottleneck.
import { BOSS_ARENAS, DEFAULT_BOSS_ARENA } from '../data/bossArenas.js';

export const ARENA_R = 15;            // circle radius, centre-to-wall (tiles)
export const ARENA_PLAZA_CHEB = 4;    // open central plaza radius (Chebyshev)
export const ARENA_LANE_HALF = 2;     // half-width of the clear N-S entrance/exit lane
export const ARENA_RING_TILES = 5;    // open perimeter lap lane, in tiles of floor
export const ARENA_OUTER_FRAC = 0.72; // …and features never pass this fraction of R

// How far from the centre a feature cell may sit. The tile ring is the binding rule
// at every radius we'd ship; the fraction only takes over past R≈18, so an arena
// grown much larger still reads as a ring of cover rather than a lonely inner island.
export function maxFeatureR(R) {
  return Math.min(ARENA_OUTER_FRAC * R, R - ARENA_RING_TILES);
}

// Terrain codes (mirror of the legacy tile legend) — kept local so the module is
// self-contained. 0 floor · 1 wall · 2 stairs down · 7 lava · 8 spikes · 12 stairs up.
const T_FLOOR = 0, T_WALL = 1;

export function arenaLayoutFor(type) {
  return (type && BOSS_ARENAS[type]) || DEFAULT_BOSS_ARENA;
}

// The map dimension for an arena of radius R (circle + a wall margin). Matches the
// legacy BOSS_ARENA_SIZE so the pure grid and the live floor are the same size.
export function arenaSize(R) { return R * 2 + 5; }

// A w×h box as offset cells centred on the anchor, biased INWARD on even sizes so a
// blob never grows out into the perimeter ring.
function boxOffsets(w, h) {
  const cells = [], ox = w >> 1, oy = h >> 1;
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.push([i - ox, j - oy]);
  return cells;
}
function blobOffsets(spec) { return spec.blob || boxOffsets(spec.w || 1, spec.h || 1); }

// The anchor(s) a spec places its blob at, each with a mirror sign so shapes stay
// symmetric. `quad` fills four corners, `axisH` mirrors east/west, `ring` walks a circle.
function anchorsFor(spec, R) {
  const out = [];
  const rr = (f) => Math.round((f == null ? spec.r : f) * R);
  if (spec.shape === 'quad') {
    const ax = rr(spec.rx), ay = rr(spec.ry);
    for (const sx of [1, -1]) for (const sy of [1, -1]) out.push({ ax, ay, sx, sy });
  } else if (spec.shape === 'axisH') {
    const ax = rr(spec.rx);
    for (const sx of [1, -1]) out.push({ ax, ay: 0, sx, sy: 1 });
  } else if (spec.shape === 'ring') {
    const n = spec.count || 6, rad = (spec.r || 0.5) * R, phase = (spec.phase || 0) * Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const a = phase + i * 2 * Math.PI / n;
      out.push({ ax: Math.round(Math.cos(a) * rad), ay: Math.round(Math.sin(a) * rad), sx: 1, sy: 1 });
    }
  }
  return out;
}

// The furthest any cell of `blob` sits from its anchor.
function blobReach(blob, ax, ay) {
  let far = 0;
  for (const [ddx, ddy] of blob) far = Math.max(far, Math.hypot(ax + ddx, ay + ddy));
  return far;
}

// Slide an anchor straight in toward the centre until its WHOLE blob clears the
// perimeter lap lane. A spec that reaches too far loses ground, not cells: pulling
// the anchor keeps the pillar/pool the shape its layout asked for, where dropping
// the out-of-bounds cells would gnaw a 2×2 column down to an L.
function pullInside(ax, ay, blob, maxR) {
  const d0 = Math.hypot(ax, ay);
  if (!d0 || blobReach(blob, ax, ay) <= maxR) return [ax, ay];
  let x = ax, y = ay;
  for (let d = d0 - 1; d > 0; d--) {
    x = Math.round(ax * (d / d0)); y = Math.round(ay * (d / d0));
    if (blobReach(blob, x, y) <= maxR) break;
  }
  return [x, y];
}

// Expand a layout into the concrete feature cells to stamp, as {dx, dy, tile} offsets
// from the arena centre. Blobs reaching into the perimeter ring are pulled inward;
// anything still landing in the plaza, the N-S lane or outside the floor circle is
// dropped — together, the safety net that keeps a bad layout from sealing the room.
export function arenaFeatureCells(type, R) {
  const layout = arenaLayoutFor(type);
  const plaza = ARENA_PLAZA_CHEB, lane = ARENA_LANE_HALF;
  const maxR = maxFeatureR(R), maxR2 = maxR * maxR;
  const floor2 = (R - 1) * (R - 1);
  const seen = new Set(), cells = [];
  for (const spec of (layout.features || [])) {
    const blob = blobOffsets(spec);
    for (const { ax, ay, sx, sy } of anchorsFor(spec, R)) {
      const [cax, cay] = pullInside(ax, ay, blob, maxR);
      for (const [ddx, ddy] of blob) {
        const dx = sx * (cax + ddx), dy = sy * (cay + ddy);
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= plaza) continue; // keep the plaza open
        if (Math.abs(dx) <= lane) continue;                          // keep the N-S lane open
        const d2 = dx * dx + dy * dy;
        if (d2 > maxR2 || d2 > floor2) continue;                     // keep the perimeter ring open
        const key = dx + ',' + dy;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push({ dx, dy, tile: spec.tile });
      }
    }
  }
  return cells;
}

// Build the full arena terrain: a stone circle of radius R with the layout's cover
// and hazards stamped in. Returns the grid plus its geometry. No stairs — the legacy
// caller drops those (their type depends on the arrival direction).
export function carveArenaGrid(type, R) {
  const size = arenaSize(R), cx = size >> 1, cy = size >> 1, R2 = R * R;
  const grid = [];
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      grid[y][x] = (dx * dx + dy * dy <= R2) ? T_FLOOR : T_WALL;
    }
  }
  for (const { dx, dy, tile } of arenaFeatureCells(type, R)) {
    const x = cx + dx, y = cy + dy;
    if (grid[y] && grid[y][x] === T_FLOOR) grid[y][x] = tile;
  }
  return { grid, size, cx, cy };
}

// The hero enters two tiles inside the south wall and leaves two inside the north.
export function arenaEntrance(R, cx, cy) { return { x: cx, y: cy + R - 2 }; }
export function arenaExit(R, cx, cy) { return { x: cx, y: cy - R + 2 }; }

// A tile the hero can stand on (lava/spikes hurt but are passable; walls and cracked
// walls are not). Used to prove the exit is reachable without shoving through a wall.
function heroWalkable(t) { return t === T_FLOOR || t === 7 || t === 8; }

// Flood from (sx,sy); returns the set of "x,y" keys reachable over `passable` tiles.
function flood(grid, sx, sy, passable) {
  const H = grid.length, W = grid[0].length;
  const seen = new Set([sy + ',' + sx]), stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny + ',' + nx;
      if (seen.has(k) || !passable(grid[ny][nx])) continue;
      seen.add(k); stack.push([nx, ny]);
    }
  }
  return seen;
}

// Reachable footprint anchors for a `size`×`size` guardian flooding out from (sx,sy).
// An anchor is standable only when its whole footprint is open floor (tile 0) — the
// same rule the live enemy mover uses. Returns a Set of "x,y" anchor keys.
function bossFlood(grid, sx, sy, size) {
  const H = grid.length, W = grid[0].length;
  const fits = (x, y) => {
    if (x < 0 || y < 0 || x + size > W || y + size > H) return false;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) if (grid[y + j][x + i] !== T_FLOOR) return false;
    return true;
  };
  if (!fits(sx, sy)) return new Set();
  const seen = new Set([sy + ',' + sx]), stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny + ',' + nx;
      if (!seen.has(k) && fits(nx, ny)) { seen.add(k); stack.push([nx, ny]); }
    }
  }
  return seen;
}

// Anchors that are the SOLE link between two halves of the guardian's roaming area
// — articulation points of the anchor graph. Each one is a spot where the only legal
// footprint is a single tile, i.e. the guardian threading a needle between cover and
// the wall. Since it lumbers greedily (one axis, then the other) rather than pathing,
// a needle is where it visibly wedges, so we treat any as a broken arena.
// (Tarjan, iterated rather than recursed — an arena holds ~700 anchors at size 1.)
export function pinchAnchors(anchors) {
  const keys = [...anchors], n = keys.length;
  if (n < 3) return [];
  const idx = new Map(keys.map((k, i) => [k, i]));
  const adj = keys.map((k) => {
    const c = k.split(','), y = +c[0], x = +c[1], out = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = idx.get((y + dy) + ',' + (x + dx));
      if (j !== undefined) out.push(j);
    }
    return out;
  });
  // A node cuts the graph when some DFS child's subtree can't reach back above it
  // (at the root, when it has more than one child).
  const disc = new Int32Array(n).fill(-1), low = new Int32Array(n);
  const parent = new Int32Array(n).fill(-1), isCut = new Uint8Array(n);
  let timer = 0;
  for (let s = 0; s < n; s++) {
    if (disc[s] !== -1) continue;
    disc[s] = low[s] = timer++;
    let rootKids = 0;
    const stack = [[s, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1], u = top[0], e = top[1]++;
      if (e < adj[u].length) {
        const v = adj[u][e];
        if (disc[v] === -1) {
          parent[v] = u; disc[v] = low[v] = timer++;
          if (u === s) rootKids++;
          stack.push([v, 0]);
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      } else {
        stack.pop();
        const p = parent[u];
        if (p !== -1) {
          low[p] = Math.min(low[p], low[u]);
          if (p !== s && low[u] >= disc[p]) isCut[p] = 1;
        }
      }
    }
    if (rootKids > 1) isCut[s] = 1;
  }
  return keys.filter((_, i) => isCut[i]);
}

// Prove an arena is fair to fight in. Returns a list of problems (empty = good):
//   'player-path'  the hero can't walk from the entrance to the exit,
//   'boss-boxed'   a `size`×`size` guardian can't lumber out toward the north,
//                  south, east AND west of the room from its central spawn,
//   'boss-pinch'   it CAN get there, but only by threading a one-tile-wide needle
//                  between cover and the wall — where it wedges instead.
// The systems test runs this over every layout so a too-tight arena fails CI.
export function arenaNavIssues(type, R = ARENA_R, size = 3) {
  const { grid, cx, cy } = carveArenaGrid(type, R);
  const issues = [];
  const ent = arenaEntrance(R, cx, cy), ex = arenaExit(R, cx, cy);
  const heroReach = flood(grid, ent.x, ent.y, heroWalkable);
  if (!heroReach.has(ex.y + ',' + ex.x)) issues.push('player-path');

  const anchors = bossFlood(grid, cx - 1, cy - 1, size);
  // How far the guardian's footprint can push toward each wall from centre.
  let north = cy, south = cy, east = cx, west = cx;
  for (const k of anchors) {
    const c = k.split(','), ay = +c[0], ax = +c[1];
    north = Math.min(north, ay);          // footprint top edge
    south = Math.max(south, ay + size - 1); // footprint bottom edge
    west = Math.min(west, ax);
    east = Math.max(east, ax + size - 1);
  }
  // Must lap the room: reach within the perimeter ring on every side.
  const margin = ARENA_RING_TILES;
  if (!anchors.size ||
      north > cy - (R - margin) || south < cy + (R - margin) ||
      west > cx - (R - margin) || east < cx + (R - margin)) {
    issues.push('boss-boxed');
  }
  // Only a multi-tile guardian wedges: it lumbers greedily on one axis then the
  // other, so a needle stops it dead. A 1×1 foe paths around obstacles instead, and
  // legitimately noses into single-tile nooks (the circle's north and south tips).
  if (size > 1 && pinchAnchors(anchors).length) issues.push('boss-pinch');
  return issues;
}
