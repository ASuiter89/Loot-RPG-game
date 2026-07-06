// ── ISLAND FLOORS ──────────────────────────────────────────────────────────
// Turn an ordinary dungeon floor into an ISLAND: the rock frame around the map's
// edge becomes the surrounding sea, so the landmass reads as ringed by open water.
//
// Pure geometry — no RNG, no globals, no DOM — so it unit-tests cleanly and the
// caller (generateMap) just paints the returned cells as water.
//
// We flood inward from the map border THROUGH rock only, and no deeper than
// `margin` tiles from the nearest edge. That yields ONE connected ring of sea that
// hugs the coastline:
//   • the outermost ring (always rock) is guaranteed to become water — a full sea
//     frame, never a gap,
//   • carved floor / corridors / rooms / stairs / hazards are never touched (only
//     plain `rock` cells flood), so a moat can NEVER sever a walkable route — the
//     tiles it eats were already impassable, and
//   • interior walls and pillars (rock that isn't connected to the edge through
//     rock) stay solid, so the dungeon inside still reads as a dungeon rather than
//     dissolving into an archipelago of causeways.
//
// grid : rows of tile codes, indexed grid[y][x].
// W, H : map dimensions in tiles.
// margin : how far in from each edge the sea reaches (tiles). ≤0 → no moat.
// rock : the wall tile code that becomes sea (plain rock only — breakable/cracked
//        walls, doors, stairs, hazards and floor are all deliberately left alone).
// Returns an array of { x, y } cells the caller should set to the water tile.
export function moatCells(grid, W, H, margin, rock = 1) {
  const out = [];
  if (!grid || W <= 0 || H <= 0 || margin <= 0) return out;
  const edgeDist = (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y);
  const seen = new Uint8Array(W * H);
  const queue = [];
  const consider = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (seen[i]) return;
    if (edgeDist(x, y) >= margin) return;   // deeper inland than the sea reaches
    if (!grid[y] || grid[y][x] !== rock) return; // only plain rock turns to sea
    seen[i] = 1;
    queue.push(x, y);
    out.push({ x, y });
  };
  // Seed from the whole outer ring, then flood inward through connected rock.
  for (let x = 0; x < W; x++) { consider(x, 0); consider(x, H - 1); }
  for (let y = 0; y < H; y++) { consider(0, y); consider(W - 1, y); }
  for (let h = 0; h < queue.length; h += 2) {
    const x = queue[h], y = queue[h + 1];
    consider(x + 1, y); consider(x - 1, y); consider(x, y + 1); consider(x, y - 1);
  }
  return out;
}

// How far the sea eats in from each edge, scaled gently with the map so bigger
// difficulty tiers still read as an island rather than a puddle-rimmed box.
// (20×20 Normal → 3 · 24 → 3 · 28 → 4 · 32 → 4.)
export function seaMargin(mapW, mapH) {
  return Math.max(2, Math.round(Math.min(mapW, mapH) * 0.14));
}
