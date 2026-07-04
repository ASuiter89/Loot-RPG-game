import { describe, it, expect } from 'vitest';
import { footprintSealsPath, inOpenArea } from '../../src/systems/decorPlacement.js';

// footprintSealsPath answers "would walling off this footprint cut the floor in two?"
// The grids below are ASCII maps: '#' = wall, '.' = open floor. We build an isWalkable
// predicate from the grid, choose a footprint, and assert whether placing it there
// would seal a path. These lock the guard that stops a multi-tile table/sofa/bed from
// plugging a corridor and stranding part of the map.

// Turn an ASCII map (array of equal-length rows) into { W, H, isWalkable }.
function grid(rows) {
  const H = rows.length, W = rows[0].length;
  const isWalkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && rows[y][x] === '.';
  return { W, H, isWalkable };
}

describe('footprintSealsPath', () => {
  it('does not seal when the piece sits in open room space (you walk around it)', () => {
    const { W, H, isWalkable } = grid([
      '######',
      '#....#',
      '#....#',
      '#....#',
      '######',
    ]);
    // A 2x1 table in the middle of the room — floor wraps around it on every side.
    expect(footprintSealsPath([[2, 2], [3, 2]], W, H, isWalkable)).toBe(false);
  });

  it('seals when a 1-wide corridor between two rooms is plugged', () => {
    // Top room (row 1) and bottom room (row 3) joined only by the corridor tile (3,2).
    const { W, H, isWalkable } = grid([
      '#######',
      '#.....#',
      '###.###',
      '#.....#',
      '#######',
    ]);
    expect(footprintSealsPath([[3, 2]], W, H, isWalkable)).toBe(true);
  });

  // A map whose only join between the top and bottom rooms is a 2-wide hall
  // (cols 2-3 of row 3). Each hall tile alone has 3 open neighbours, so an
  // anchor-only "openN >= 3" check would wrongly allow blocking it.
  const twoWideHall = [
    '######',
    '#....#',
    '#....#',
    '##..##',
    '#....#',
    '#....#',
    '######',
  ];

  it('seals when a 2-wide table blocks a 2-wide corridor (the case an anchor-only check misses)', () => {
    const { W, H, isWalkable } = grid(twoWideHall);
    // A 2x1 table spanning the full width of the hall walls the two rooms apart.
    expect(footprintSealsPath([[2, 3], [3, 3]], W, H, isWalkable)).toBe(true);
  });

  it('does not seal a 2-wide hall when a 1-wide table leaves a lane open', () => {
    const { W, H, isWalkable } = grid(twoWideHall);
    // Only one of the two hall tiles is blocked → the other lane still connects.
    expect(footprintSealsPath([[2, 3]], W, H, isWalkable)).toBe(false);
  });

  it('does not seal against a wall (only one open side to strand)', () => {
    const { W, H, isWalkable } = grid([
      '######',
      '#....#',
      '#....#',
      '######',
    ]);
    // Table tucked into the top-left corner — its exits are all one connected room.
    expect(footprintSealsPath([[1, 1], [2, 1]], W, H, isWalkable)).toBe(false);
  });

  it('does not seal a dead-end alcove (nothing beyond the footprint)', () => {
    // (5,3) is the only tile in the stub; its lone exit is (5,2) → <2 exits → false.
    const { W, H, isWalkable } = grid([
      '#######',
      '#.....#',
      '#.....#',
      '#####.#',
      '#######',
    ]);
    expect(footprintSealsPath([[5, 3]], W, H, isWalkable)).toBe(false);
  });
});

// inOpenArea answers "does this tile sit in a fully-open 2x2 block?" — the guard
// that keeps a solid obstacle out of a 1-tile-wide path, junction, or dead end even
// when a detour exists (so footprintSealsPath alone wouldn't reject it).
describe('inOpenArea', () => {
  it('is true for a tile in the middle of an open field', () => {
    const { isWalkable } = grid([
      '#####',
      '#...#',
      '#...#',
      '#...#',
      '#####',
    ]);
    expect(inOpenArea(2, 2, isWalkable)).toBe(true);
  });

  it('is false for the middle of a 1-wide corridor', () => {
    const { isWalkable } = grid([
      '#####',
      '##.##',
      '##.##',
      '##.##',
      '#####',
    ]);
    expect(inOpenArea(2, 2, isWalkable)).toBe(false);
  });

  it('is false at a junction of 1-wide corridors (3-4 open neighbours, still 1 wide)', () => {
    // A '+' crossing: the centre has 4 open orthogonal neighbours yet every arm is
    // 1 tile wide — an obstacle here blocks the way. The old openN>=3 test passed it.
    const { isWalkable } = grid([
      '#####',
      '##.##',
      '#...#',
      '##.##',
      '#####',
    ]);
    expect(inOpenArea(2, 2, isWalkable)).toBe(false);
  });

  it('is false at a corridor mouth opening into a field', () => {
    // (2,3) is where the 1-wide corridor meets the field below: 3 open neighbours,
    // but no 2x2 of open floor contains it, so an obstacle there plugs the mouth.
    const { isWalkable } = grid([
      '#####',
      '##.##',
      '##.##',
      '#...#',
      '#####',
    ]);
    expect(inOpenArea(2, 3, isWalkable)).toBe(false);
  });

  it('is true for a tile on the edge of a wide room (open 2x2 to one side)', () => {
    const { isWalkable } = grid([
      '#####',
      '#...#',
      '#...#',
      '#####',
    ]);
    // (1,1) hugs the left wall but still anchors a full open 2x2 to its right/down.
    expect(inOpenArea(1, 1, isWalkable)).toBe(true);
  });
});
