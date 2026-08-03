import { describe, it, expect } from 'vitest';
import { chaseStep, bodyDist, bodyFits } from '../../src/systems/chasePath.js';

// ASCII grids drive every case. Glyphs:
//   '#' wall / solid furniture (blocks a body AND blocks a diagonal squeeze)
//   'o' another foe — blocks a body, but is not terrain (no corner-cut effect)
//   '.' open floor      'S' the mover's anchor (top-left of its body)
//   'T' the target (the hero) — blocked, since nothing stands on the hero
function parse(rows) {
  const H = rows.length, W = rows[0].length;
  const blocked = new Uint8Array(W * H), solid = new Uint8Array(W * H);
  let sx = 0, sy = 0, tx = 0, ty = 0, found = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = rows[y][x], i = y * W + x;
    if (c === '#') { blocked[i] = 1; solid[i] = 1; }
    if (c === 'o') blocked[i] = 1;
    if (c === 'S' && !found) { sx = x; sy = y; found = true; }   // first 'S' = the body's anchor
    if (c === 'T') { tx = x; ty = y; blocked[i] = 1; }
  }
  return { W, H, blocked, solid, sx, sy, tx, ty };
}

// Run a full chase to completion and report the squares walked. Bails out at
// `cap` so a stall or a loop fails loudly instead of hanging the suite.
function walk(rows, size, reach, cap = 200) {
  const g = parse(rows);
  let x = g.sx, y = g.sy;
  const trail = [[x, y]];
  for (let i = 0; i < cap; i++) {
    // The mover's own body is marked blocked on the real grid too, and chaseStep
    // is expected to exempt it — so stamp it in and let the search handle it.
    const grid = g.blocked.slice();
    for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) grid[(y + dy) * g.W + x + dx] = 1;
    const step = chaseStep(g.W, g.H, grid, g.solid, x, y, size, g.tx, g.ty, reach);
    if (!step) break;
    x += step[0]; y += step[1];
    trail.push([x, y]);
  }
  return { trail, x, y, dist: bodyDist(x, y, size, g.tx, g.ty), steps: trail.length - 1 };
}

describe('bodyDist', () => {
  it('measures from the nearest cell of the body, not its anchor', () => {
    // A 3x3 body anchored at (0,0) spans x/y 0..2; a target at (4,1) is 2 away
    // from its right edge even though the anchor is 4 columns off.
    expect(bodyDist(0, 0, 3, 4, 1)).toBe(2);
    expect(bodyDist(0, 0, 1, 4, 1)).toBe(5);
  });

  it('is zero when the target sits inside the body', () => {
    expect(bodyDist(2, 2, 3, 3, 3)).toBe(0);
  });
});

describe('bodyFits', () => {
  const W = 5, H = 5;
  it('rejects a body that hangs off the map', () => {
    const free = new Uint8Array(W * H);
    expect(bodyFits(W, H, free, 3, 3, 3, -9, -9)).toBe(false);
    expect(bodyFits(W, H, free, 2, 2, 3, -9, -9)).toBe(true);
  });

  it('ignores the cells the mover already occupies', () => {
    const grid = new Uint8Array(W * H);
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) grid[y * W + x] = 1;  // the mover itself
    expect(bodyFits(W, H, grid, 2, 2, 2, 1, 1)).toBe(true);    // shuffling within its own body
    expect(bodyFits(W, H, grid, 2, 2, 2, -9, -9)).toBe(false); // someone ELSE standing there
  });
});

describe('chaseStep', () => {
  it('returns no step when already in position', () => {
    const g = parse(['.....', '.S.T.', '.....']);
    // reach 1 = "end beside the target"; the mover is two tiles off, so it moves…
    expect(chaseStep(g.W, g.H, g.blocked, g.solid, g.sx, g.sy, 1, g.tx, g.ty, 1)).toEqual([1, 0]);
    // …but from the adjacent square there is nothing left to do.
    expect(chaseStep(g.W, g.H, g.blocked, g.solid, 2, 1, 1, g.tx, g.ty, 1)).toBe(null);
  });

  it('walks a one-tile foe onto the hero (reach 0) across open floor', () => {
    const r = walk(['.......', '.S...T.', '.......'], 1, 0);
    expect([r.x, r.y]).toEqual([5, 1]);   // ends ON the hero's tile — the caller swings instead
    expect(r.steps).toBe(4);
  });

  it('routes a one-tile foe around a wall instead of grinding into it', () => {
    const r = walk([
      '.......',
      '.S.#.T.',
      '...#...',
      '...#...',
      '.......',
    ], 1, 0);
    expect(r.dist).toBe(0);
    // Every square walked must clear the wall column.
    for (const [x, y] of r.trail) expect(!(x === 3 && y >= 1 && y <= 3)).toBe(true);
  });

  // The reported bug: a 2x2 boss pinned against a lone rock, hero in the open
  // beyond it. The old greedy "x axis, else y axis" step had exactly one option
  // here (the hero is on the boss's rows, so the y try was a no-op), the rock
  // vetoed it, and the boss stood frozen while the hero shot it for free.
  it('walks a 2x2 body around a lone rock that blocks its straight line', () => {
    const r = walk([
      '.........',
      '.SS.#....',
      '.SS.#..T.',
      '.........',
      '.........',
    ], 2, 1);
    expect(r.dist).toBe(1);                       // ends up adjacent to the hero
    expect(r.steps).toBeGreaterThan(0);
    expect(r.steps).toBeLessThan(12);             // it detours, it doesn't wander
  });

  it('never lets a wide body overlap a solid tile on the way', () => {
    const rows = [
      '..........',
      '.SS.......',
      '.SS..#....',
      '.....#..T.',
      '.....#....',
      '..........',
    ];
    const g = parse(rows);
    const r = walk(rows, 2, 1);
    for (const [x, y] of r.trail) {
      for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
        expect(g.solid[(y + dy) * g.W + x + dx]).toBe(0);
      }
    }
    expect(r.dist).toBe(1);
  });

  // A one-row hole in a long wall: a lone vermin slips through it, a 2x2 body
  // can't — and must recognise that and take the long way round the wall's end
  // rather than shuffling against the gap forever.
  const NARROW_GAP = [
    '.....#....',
    '.SS..#....',
    '.SS..#..T.',
    '..........',
    '.....#....',
    '..........',
    '..........',
  ];

  it('sends a one-tile foe straight through a one-row gap', () => {
    const r = walk(NARROW_GAP, 1, 0);
    expect(r.dist).toBe(0);
    expect(r.trail.some(([x, y]) => x === 5 && y === 3)).toBe(true);   // used the gap
  });

  it('refuses a gap the body is too wide to enter, and goes the long way', () => {
    const r = walk(NARROW_GAP, 2, 1);
    expect(r.dist).toBe(1);
    expect(r.trail.some(([, y]) => y >= 5)).toBe(true);                // rounded the wall's end
  });

  it('stops beside the hero rather than on top of them', () => {
    const rows = ['.........', '.SS....T.', '.SS......', '.........'];
    const g = parse(rows);
    const r = walk(rows, 2, 1);
    expect(r.dist).toBe(1);
    // The hero's tile is never covered by the body.
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
      expect(r.x + dx === g.tx && r.y + dy === g.ty).toBe(false);
    }
  });

  it('will not squeeze a diagonal between two solid corners', () => {
    // The mover's diagonal toward the hero is (2,2), and both cells flanking it
    // — (2,1) and (1,2) — are walls, so that squeeze is off the table.
    const g = parse([
      '.....',
      '.S#..',
      '.#...',
      '...T.',
      '.....',
    ]);
    const step = chaseStep(g.W, g.H, g.blocked, g.solid, g.sx, g.sy, 1, g.tx, g.ty, 0);
    expect(step).not.toEqual([1, 1]);
  });

  it('presses as close as it can when the hero is walled off entirely', () => {
    // The hero sits in a sealed pocket. A frozen foe is the whole bug, so the
    // search must still hand back a step that closes the gap.
    const rows = [
      '#######',
      '#S....#',
      '#.....#',
      '#.....#',
      '#######',
      '###T###',
      '#######',
    ];
    const r = walk(rows, 1, 0);
    expect(r.dist).toBeLessThan(bodyDist(1, 1, 1, 3, 5));   // it moved nearer
    expect(r.dist).toBeGreaterThan(0);                      // …but never got there
    expect(r.y).toBe(3);                                    // pressed up against the seal
  });

  it('gives up quietly when boxed in with nowhere better to stand', () => {
    const g = parse([
      '#####',
      '##T##',
      '#####',
      '##S##',
      '#####',
    ]);
    expect(chaseStep(g.W, g.H, g.blocked, g.solid, g.sx, g.sy, 1, g.tx, g.ty, 0)).toBe(null);
  });

  it('treats another foe as blocking without blocking the diagonal past it', () => {
    // 'o' is a foe, not terrain: the mover may not step onto it, but the
    // corner-cut rule (walls only) still permits the diagonal alongside it.
    const g = parse([
      '.....',
      '.So..',
      '.o...',
      '...T.',
    ]);
    expect(chaseStep(g.W, g.H, g.blocked, g.solid, g.sx, g.sy, 1, g.tx, g.ty, 0)).toEqual([1, 1]);
  });

  it('rejects degenerate grids', () => {
    const free = new Uint8Array(4);
    expect(chaseStep(0, 0, free, free, 0, 0, 1, 0, 0, 0)).toBe(null);
    expect(chaseStep(2, 2, free, free, 0, 0, 0, 1, 1, 0)).toBe(null);
  });

  it('survives the 16-bit generation stamp wrapping', () => {
    // The stamps live in a Uint16Array; if the generation outgrows that width
    // without wrapping, dedupe dies and every foe freezes. Drive the counter
    // past 0xffff and confirm the very next chase still finds its route.
    const g = parse(['.......', '.S.#.T.', '...#...', '.......']);
    let step = null;
    for (let i = 0; i < 70000; i++) {
      step = chaseStep(g.W, g.H, g.blocked, g.solid, g.sx, g.sy, 1, g.tx, g.ty, 0);
    }
    expect(step).not.toBe(null);
  });
});
