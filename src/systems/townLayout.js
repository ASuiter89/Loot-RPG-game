// Pure helpers over the authored static town (src/data/townLayout.js). No DOM, no
// module globals, no RNG/clock — the hero position, object lists and layout data
// are all passed in, so every function is deterministic and unit-testable. The
// DOM/pointer/interaction wiring that consumes these lives in the coverage-excluded
// src/legacy/game.js (buildTown / pickup / drawTownObjects), per the input rule.

// Expand cobble-path rects [{x,y,w,h}] into a Set of "x,y" tile keys.
export function expandPaths(rects) {
  const set = new Set();
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) set.add(x + ',' + y);
    }
  }
  return set;
}

// Assemble the interactable town objects: every service keeper + the Dungeon Gate,
// plus the Town Portal ONLY when a floor is held (you portaled or conquered in, so
// there is a stage to return to). Each object is {x,y,kind,name,type} with
// type ∈ 'npc' | 'gate' | 'portal'.
export function townObjects(npcs, gate, portal, hasHeldFloor) {
  const out = npcs.map((n) => ({ x: n.x, y: n.y, kind: n.kind, name: n.name, type: 'npc' }));
  out.push({ x: gate.x, y: gate.y, kind: 'gate', name: gate.name, type: 'gate' });
  if (hasHeldFloor) out.push({ x: portal.x, y: portal.y, kind: 'portal', name: portal.name, type: 'portal' });
  return out;
}

// The interactable nearest to (px,py) within Chebyshev `range` (default 1 tile —
// the 8 neighbours plus the same tile, matching the dungeon merchant/mystic reach).
// Ties break by squared Euclidean distance, then by list order, so the result is
// deterministic. Returns null when nothing is in range.
export function nearestInteractable(px, py, objects, range = 1) {
  let best = null;
  let bestD = Infinity;
  for (const o of objects) {
    const dx = o.x - px;
    const dy = o.y - py;
    if (Math.abs(dx) > range || Math.abs(dy) > range) continue;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

// Deterministic pick from a list of decor-atlas ids for the tile (x,y) — so a
// family char (e.g. "tree") resolves to a specific, varied-but-fixed piece and the
// town looks the same on every visit. Returns null for an empty/absent list.
export function pickDecorVariant(ids, x, y) {
  if (!ids || !ids.length) return null;
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return ids[h % ids.length];
}

// 4-connected flood fill: the Set of "x,y" tiles reachable from `start`, treating
// membership in `blocked` (a Set of "x,y") or out-of-bounds as impassable.
export function reachableTiles(blocked, w, h, start) {
  const seen = new Set([start.x + ',' + start.y]);
  const stack = [[start.x, start.y]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const cur = stack.pop();
    for (const d of dirs) {
      const nx = cur[0] + d[0];
      const ny = cur[1] + d[1];
      const k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

// Does at least one orthogonal neighbour of `o` lie in the reachable set `reach`?
// (You interact from an adjacent tile, so an object is usable iff you can stand
// beside it.)
export function isApproachable(o, reach) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return dirs.some((d) => reach.has((o.x + d[0]) + ',' + (o.y + d[1])));
}

// Is tile (x,y) inside the endgame sanctum's inclusive bounding box `b`
// ({x0,y0,x1,y1}, e.g. TOWN_SANCTUM)? The endgame keepers own this hedged grove;
// buildTown walls it off from the wander free-set and updateTownNpcs re-checks it,
// so a strolling regular keeper never wanders into the endgame room.
export function inSanctum(x, y, b) {
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}
