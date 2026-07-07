// Locked-vault selection + carving geometry. Pure, deterministic helpers over an
// injected `rng` (production passes Math.random; tests seed mulberry32); the legacy
// monolith owns the mutable map, the spawns and the render. See the flavour table
// in `src/data/vaultRooms.js`.
import { VAULT_ROOMS } from '../data/vaultRooms.js';

// Weighted pick of a vault flavour. `opts.deepOK` gates the two-floor express stair
// (only offered when there's actually room to descend that far).
export function pickVaultRoom(rng, opts = {}) {
  const pool = VAULT_ROOMS.filter(v => !v.needsDeep || opts.deepOK);
  const total = pool.reduce((a, v) => a + v.weight, 0);
  let r = rng() * total;
  for (const v of pool) { r -= v.weight; if (r <= 0) return v; }
  return pool[pool.length - 1];   // fp slop — hand back the last entry
}

// Find a spot to carve a fully-sealed `w`×`h` room out of solid rock, reachable
// only through a single locked door. Pure: reads `mapData` (1 = rock) and the
// caller's `isReachable(x, y)` predicate (an already-reachable open floor tile),
// mutates nothing. Returns `{ rx, ry, w, h, door:{x,y}, cells:[{x,y}…] }` or null.
//
// The whole rectangle AND its one-tile border must be rock, so the room touches no
// existing floor except at the door — that keeps the lock meaningful (you can't
// stroll in from the side). The door is a border tile whose OUTWARD neighbour is
// reachable floor: carve door→locked, rectangle→floor, and the room joins the map
// through that one cell.
export function findSealedRoom(mapData, isReachable, w, h, rng) {
  const H = mapData.length, W = (mapData[0] || []).length;
  if (W < w + 6 || H < h + 6) return null;   // no room to fit the rect + its ring
  const rock = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mapData[y][x] === 1;
  const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
  for (let tries = 0; tries < 240; tries++) {
    const rx = rint(2, W - w - 3), ry = rint(2, H - h - 3);
    // The rectangle plus its surrounding one-tile ring must all be solid rock.
    let solid = true;
    for (let y = ry - 1; y <= ry + h && solid; y++) {
      for (let x = rx - 1; x <= rx + w; x++) {
        if (!rock(x, y)) { solid = false; break; }
      }
    }
    if (!solid) continue;
    // Door candidates: a ring cell centred on an edge whose outward neighbour (two
    // tiles out from the rectangle) is reachable floor.
    const cand = [];
    for (let x = rx; x < rx + w; x++) {
      if (isReachable(x, ry - 2)) cand.push({ x, y: ry - 1 });         // top edge
      if (isReachable(x, ry + h + 1)) cand.push({ x, y: ry + h });     // bottom edge
    }
    for (let y = ry; y < ry + h; y++) {
      if (isReachable(rx - 2, y)) cand.push({ x: rx - 1, y });         // left edge
      if (isReachable(rx + w + 1, y)) cand.push({ x: rx + w, y });     // right edge
    }
    if (!cand.length) continue;
    const door = cand[Math.floor(rng() * cand.length)];
    const cells = [];
    for (let y = ry; y < ry + h; y++) for (let x = rx; x < rx + w; x++) cells.push({ x, y });
    return { rx, ry, w, h, door, cells };
  }
  return null;
}
