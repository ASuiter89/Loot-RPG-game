import { describe, it, expect } from 'vitest';
import { footReach, firstStrandedTile, pathToRegion } from '../../src/systems/pathReach.js';

// ASCII grids drive both helpers. Glyphs:
//   '#' wall (not enterable)      '.' plain floor (enter + walk-through)
//   'S' start tile                'X' solid object on floor (enter-blocked)
//   '>' terminal tile (stairs)    — enterable but NOT walk-through
// A "solid object" (X) sits on a floor tile the object seals; the bare terrain
// underneath is still floor, which is exactly how furniture/NPCs block a path.
function parse(rows) {
  const H = rows.length, W = rows[0].length;
  let sx = 0, sy = 0;
  const at = (x, y) => rows[y][x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === 'S') { sx = x; sy = y; }
  // terrain-only walkability (objects invisible): floor / start / object-tile / terminal
  const terrainEnter = (x, y) => '.SX>'.includes(at(x, y));
  const terrainThrough = (x, y) => '.SX'.includes(at(x, y));       // '>' is terminal
  // object-aware walkability: an X tile is sealed
  const objEnter = (x, y) => '.S>'.includes(at(x, y));
  const objThrough = (x, y) => '.S'.includes(at(x, y));
  return { W, H, sx, sy, at, terrainEnter, terrainThrough, objEnter, objThrough };
}

describe('footReach', () => {
  it('covers a fully-open room', () => {
    const g = parse([
      '#####',
      '#S..#',
      '#...#',
      '#####',
    ]);
    const r = footReach(g.W, g.H, g.sx, g.sy, g.terrainEnter, g.terrainThrough);
    // 6 open floor tiles (2 rows x 3 cols)
    expect(r.size).toBe(6);
    expect(r.has('1,3')).toBe(true);   // y=1,x=3 far corner
  });

  it('treats stairs as a dead-end you can reach but not pass through', () => {
    // The only link from the left room to the right room is the stair '>' at (3,1).
    const g = parse([
      '######',
      '#S#..#',
      '#.>..#',
      '#.#..#',
      '######',
    ]);
    const r = footReach(g.W, g.H, g.sx, g.sy, g.terrainEnter, g.terrainThrough);
    expect(r.has('2,2')).toBe(true);   // the stair tile itself is reachable
    expect(r.has('1,4')).toBe(false);  // …but the room beyond it is NOT (terminal)
  });

  it('expands out of a terminal START tile (hero spawns on the stairs)', () => {
    const g = parse([
      '#####',
      '#>..#',   // start replaced below
      '#####',
    ]);
    // start on the stair at (1,1)
    const r = footReach(g.W, g.H, 1, 1, g.terrainEnter, g.terrainThrough);
    expect(r.has('1,3')).toBe(true);   // still reaches down the corridor
  });

  it('an object seals off the tiles behind it (object-aware flood)', () => {
    // A 1-wide corridor plugged by a solid object at (3,2) cuts the far room off.
    const g = parse([
      '#######',
      '#S....#',
      '###X###',
      '#.....#',
      '#######',
    ]);
    const terrain = footReach(g.W, g.H, g.sx, g.sy, g.terrainEnter, g.terrainThrough);
    const objAware = footReach(g.W, g.H, g.sx, g.sy, g.objEnter, g.objThrough);
    expect(terrain.has('3,3')).toBe(true);    // bottom room IS terrain-reachable
    expect(objAware.has('3,3')).toBe(false);  // …but the object walls it off
  });
});

describe('firstStrandedTile', () => {
  // For these, terrain = floor '.', start 'S', object 'X' (on floor). objectSolid
  // marks the 'X' tiles. enter/through are terrain-only (an X tile is still floor
  // underneath, so terrain reaches it — exactly the real furniture/NPC case).
  const preds = (g) => ({
    enter: (x, y) => '.SX>'.includes(g.at(x, y)),
    through: (x, y) => '.SX'.includes(g.at(x, y)),
    objectSolid: (x, y) => g.at(x, y) === 'X',
  });

  it('flags the EMPTY floor an object sealed off, never the object tile itself', () => {
    const g = parse([
      '#######',
      '#S....#',
      '###X###',
      '#.....#',
      '#######',
    ]);
    const p = preds(g);
    const { stranded } = firstStrandedTile(g.W, g.H, g.sx, g.sy, p.enter, p.through, p.objectSolid);
    expect(stranded).not.toBeNull();
    // the strand must be an EMPTY bottom-room tile (y=3), NOT the object tile (3,2)
    expect(stranded[1]).toBe(3);
    expect(g.at(stranded[0], stranded[1])).toBe('.');
  });

  it('returns null when an object sits in OPEN space (walk around it) — the regression', () => {
    // The classic false-positive: an object on open floor is terrain-reachable but
    // never object-reachable (you stand around it, not on it). It must NOT be
    // reported as a strand — else the repair would needlessly strip it.
    const g = parse([
      '######',
      '#....#',
      '#.SX.#',
      '#....#',
      '######',
    ]);
    const p = preds(g);
    const { stranded } = firstStrandedTile(g.W, g.H, g.sx, g.sy, p.enter, p.through, p.objectSolid);
    expect(stranded).toBeNull();
  });

  it('returns null when there are no objects at all', () => {
    const g = parse([
      '######',
      '#S...#',
      '#....#',
      '######',
    ]);
    const p = preds(g);
    const { stranded } = firstStrandedTile(g.W, g.H, g.sx, g.sy, p.enter, p.through, p.objectSolid);
    expect(stranded).toBeNull();
  });

  it('routes a strand OVER the sealing object, not to a TERMINAL stair', () => {
    // Two regions joined by a TERMINAL stair (top, '>') and an object (bottom, 'X').
    // Once X is placed, the right region is foot-stranded (you can reach the stair
    // but not walk past it). The repair lane must cross X — routing to the stair
    // (object-reachable but terminal) would clear nothing.
    const g = parse([
      '#######',
      '#S.>..#',
      '#.###.#',
      '#..X..#',
      '#######',
    ]);
    const p = preds(g);
    const { stranded, objReach } = firstStrandedTile(g.W, g.H, g.sx, g.sy, p.enter, p.through, p.objectSolid);
    expect(stranded).not.toBeNull();
    expect(stranded[0]).toBeGreaterThanOrEqual(4);       // a right-region tile is stranded
    const hasObj = (path) => !!path && path.some(([x, y]) => x === 3 && y === 3);
    // Naive target (ANY object-reachable tile) from (4,1) routes to the adjacent
    // stair — an object-free lane that clears nothing (the bug).
    const naive = pathToRegion(g.W, g.H, 4, 1, p.through, (x, y) => objReach.has(y + ',' + x));
    expect(hasObj(naive)).toBe(false);
    // Walk-through target forces the lane across the sealing object so it clears.
    const fixed = pathToRegion(g.W, g.H, 4, 1, p.through, (x, y) => p.through(x, y) && objReach.has(y + ',' + x));
    expect(hasObj(fixed)).toBe(true);
  });

  it('hands back objReach so the caller can route the strand back to open ground', () => {
    const g = parse([
      '#######',
      '#S....#',
      '###X###',
      '#.....#',
      '#######',
    ]);
    const p = preds(g);
    const { stranded, objReach } = firstStrandedTile(g.W, g.H, g.sx, g.sy, p.enter, p.through, p.objectSolid);
    // top room reachable-with-objects, bottom room not
    expect(objReach.has('1,1')).toBe(true);
    expect(objReach.has('3,1')).toBe(false);
    const path = pathToRegion(g.W, g.H, stranded[0], stranded[1], p.through, (x, y) => objReach.has(y + ',' + x));
    expect(path.some(([x, y]) => x === 3 && y === 2)).toBe(true);  // routes over the object
  });
});

describe('pathToRegion', () => {
  it('routes from a stranded pocket back to the reachable region, crossing the object', () => {
    const g = parse([
      '#######',
      '#S....#',
      '###X###',
      '#.....#',
      '#######',
    ]);
    const objAware = footReach(g.W, g.H, g.sx, g.sy, g.objEnter, g.objThrough);
    // Route from a stranded bottom-room tile back to the object-reachable region,
    // stepping over terrain (objects allowed on the path — they get cleared).
    const path = pathToRegion(g.W, g.H, 1, 3, g.terrainThrough, (x, y) => objAware.has(y + ',' + x));
    expect(path).not.toBeNull();
    // The path must pass through the sealing object tile (3,2) so clearing the
    // tiles on it reopens the lane.
    expect(path.some(([x, y]) => x === 3 && y === 2)).toBe(true);
    // First tile is the stranded start, last tile is inside the reachable region.
    expect(path[0]).toEqual([1, 3]);
    expect(objAware.has(path[path.length - 1][1] + ',' + path[path.length - 1][0])).toBe(true);
  });

  it('returns a single-tile path when the start is already in the region', () => {
    const g = parse(['####', '#S.#', '####']);
    const path = pathToRegion(g.W, g.H, g.sx, g.sy, () => true, () => true);
    expect(path).toEqual([[g.sx, g.sy]]);
  });

  it('returns null when no target tile can be reached', () => {
    // Two rooms with NO connection at all.
    const g = parse([
      '#######',
      '#S.#..#',
      '#..#..#',
      '#######',
    ]);
    const path = pathToRegion(g.W, g.H, 1, 1, g.terrainThrough, (x, y) => x >= 4);
    expect(path).toBeNull();
  });

  it('finds the shortest route among several', () => {
    // Open room: straight-line Manhattan distance is the shortest path length.
    const g = parse([
      '#####',
      '#S..#',
      '#...#',
      '#..T#',
      '#####',
    ]);
    // mark target column via predicate: tile (3,3)
    const path = pathToRegion(g.W, g.H, g.sx, g.sy,
      (x, y) => '.ST'.includes(g.at(x, y)), (x, y) => x === 3 && y === 3);
    expect(path).not.toBeNull();
    // shortest length from (1,1) to (3,3) is 2+2+1 = 5 tiles inclusive
    expect(path.length).toBe(5);
  });
});
