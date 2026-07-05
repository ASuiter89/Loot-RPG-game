import { describe, it, expect } from 'vitest';
import { footprintSealsPath, footprintInsideRoom } from '../../src/systems/decorPlacement.js';

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

// footprintInsideRoom answers "does this whole footprint sit strictly inside one
// room, inset a tile from its edge?" — the guard that keeps a wide solid piece
// (bed/table/sofa) in open room space and off the doorways/corridors it would
// otherwise plug even when a detour keeps the floor connected.
describe('footprintInsideRoom', () => {
  // A single room occupying x:2..7, y:2..5 (w=6, h=4). Interior (inset 1) is
  // x:3..6, y:3..4.
  const rooms = [{ x: 2, y: 2, w: 6, h: 4 }];

  it('accepts a piece wholly inside the room interior', () => {
    expect(footprintInsideRoom([[3, 3], [4, 3]], rooms)).toBe(true);
    expect(footprintInsideRoom([[6, 4]], rooms)).toBe(true);           // interior corner
  });

  it('rejects a piece touching the room edge (where doorways open)', () => {
    expect(footprintInsideRoom([[2, 3]], rooms)).toBe(false);          // left edge column
    expect(footprintInsideRoom([[3, 2]], rooms)).toBe(false);          // top edge row
    expect(footprintInsideRoom([[7, 4]], rooms)).toBe(false);          // right edge column
    expect(footprintInsideRoom([[4, 5]], rooms)).toBe(false);          // bottom edge row
  });

  it('rejects a piece whose far tile juts out of the room (into a corridor)', () => {
    // Anchor inside, far tile past the interior into the edge/corridor.
    expect(footprintInsideRoom([[6, 3], [7, 3]], rooms)).toBe(false);
  });

  it('rejects everything when there are no rooms', () => {
    expect(footprintInsideRoom([[3, 3]], [])).toBe(false);
    expect(footprintInsideRoom([[3, 3]], undefined)).toBe(false);
  });

  it('rejects an empty footprint', () => {
    expect(footprintInsideRoom([], rooms)).toBe(false);
  });

  it('accepts a piece that fits in one of several rooms', () => {
    const many = [{ x: 0, y: 0, w: 3, h: 3 }, { x: 10, y: 10, w: 8, h: 8 }];
    expect(footprintInsideRoom([[12, 12], [13, 12]], many)).toBe(true); // fits the big room
    expect(footprintInsideRoom([[1, 1], [2, 1]], many)).toBe(false);    // tiny room has no room for a 2-wide interior span
  });
});
