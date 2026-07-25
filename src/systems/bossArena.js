// Boss-arena geometry — turns the per-guardian layouts in `src/data/bossArenas.js`
// into a concrete tile grid, with a built-in navigability safety net. Pure and
// deterministic (no rng, no DOM); the legacy monolith carves the circle by calling
// `carveArenaGrid` and stamps the result into `mapData`.
//
// Every arena is a stone circle of radius R. Three regions are ALWAYS kept open,
// whatever the layout asks for, so a guardian (up to 3×3) can never be boxed in and
// the hero can always reach the exit:
//   • the central PLAZA (Chebyshev ≤ ARENA_PLAZA_CHEB) — the guardian's ground,
//   • the north-south LANE (|dx| ≤ ARENA_LANE_HALF) — entrance stair ↔ exit stair,
//   • the perimeter RING (outside ARENA_OUTER_FRAC·R) — a lap lane around the wall.
// Cover and hazards live in the annulus between plaza and ring. `arenaNavIssues`
// re-derives the grid and flood-fills it to prove the invariant; the systems test
// runs it on all fifteen layouts.
import { BOSS_ARENAS, DEFAULT_BOSS_ARENA } from '../data/bossArenas.js';

export const ARENA_PLAZA_CHEB = 3;    // open central plaza radius (Chebyshev)
export const ARENA_LANE_HALF = 1;     // half-width of the clear N-S entrance/exit lane
export const ARENA_OUTER_FRAC = 0.72; // features stay within this fraction of R

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

// Expand a layout into the concrete feature cells to stamp, as {dx, dy, tile} offsets
// from the arena centre. Anything that would land in the plaza, the N-S lane, the
// perimeter ring, or outside the floor circle is dropped here — the safety net that
// keeps a bad layout from sealing the room.
export function arenaFeatureCells(type, R) {
  const layout = arenaLayoutFor(type);
  const plaza = ARENA_PLAZA_CHEB, lane = ARENA_LANE_HALF;
  const outer = ARENA_OUTER_FRAC * R, outer2 = outer * outer;
  const floor2 = (R - 1) * (R - 1);
  const seen = new Set(), cells = [];
  for (const spec of (layout.features || [])) {
    const blob = blobOffsets(spec);
    for (const { ax, ay, sx, sy } of anchorsFor(spec, R)) {
      for (const [ddx, ddy] of blob) {
        const dx = sx * (ax + ddx), dy = sy * (ay + ddy);
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= plaza) continue; // keep the plaza open
        if (Math.abs(dx) <= lane) continue;                          // keep the N-S lane open
        const d2 = dx * dx + dy * dy;
        if (d2 > outer2 || d2 > floor2) continue;                    // keep the perimeter ring open
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

// Prove an arena is fair to fight in. Returns a list of problems (empty = good):
//   'player-path'  the hero can't walk from the entrance to the exit,
//   'boss-boxed'   a `size`×`size` guardian can't lumber out toward the north,
//                  south, east AND west of the room from its central spawn.
// The systems test runs this over every layout so a too-tight arena fails CI.
export function arenaNavIssues(type, R, size = 3) {
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
  const margin = 5; // must reach within ~5 tiles of the wall on every side
  if (!anchors.size ||
      north > cy - (R - margin) || south < cy + (R - margin) ||
      west > cx - (R - margin) || east < cx + (R - margin)) {
    issues.push('boss-boxed');
  }
  return issues;
}
