import { describe, it, expect } from 'vitest';
import { moatCells, seaMargin } from '../../src/systems/islandFloor.js';

// Build a W×H grid of a single tile code, then let a callback carve it.
function grid(W, H, fill, carve) {
  const g = Array.from({ length: H }, () => Array.from({ length: W }, () => fill));
  if (carve) carve(g);
  return g;
}
const has = (cells, x, y) => cells.some((c) => c.x === x && c.y === y);

describe('moatCells', () => {
  it('floods every edge-adjacent rock ring up to the margin, never the interior', () => {
    // 7×7 solid rock with a 3×3 floor room in the middle (x,y ∈ 2..4).
    const g = grid(7, 7, 1, (m) => {
      for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) m[y][x] = 0;
    });
    const cells = moatCells(g, 7, 7, 2);
    // Outer two rings (edgeDist 0 and 1) are all rock and border-connected → sea.
    expect(has(cells, 0, 0)).toBe(true);   // corner
    expect(has(cells, 6, 6)).toBe(true);   // opposite corner
    expect(has(cells, 1, 3)).toBe(true);   // ring-1 edge
    // The room and anything at edgeDist ≥ margin stay dry.
    expect(has(cells, 2, 2)).toBe(false);  // edgeDist 2 == margin → not flooded
    expect(has(cells, 3, 3)).toBe(false);  // room centre (floor anyway)
    // 49 tiles − the inner 3×3 (edgeDist ≥ 2) = 40 flooded.
    expect(cells).toHaveLength(40);
  });

  it('guarantees a full water frame: the whole outer ring floods', () => {
    const g = grid(6, 6, 1);
    const cells = moatCells(g, 6, 6, 1);
    for (let x = 0; x < 6; x++) {
      expect(has(cells, x, 0)).toBe(true);
      expect(has(cells, x, 5)).toBe(true);
    }
    // margin 1 → only the border ring: a 6×6 has 6·6 − 4·4 = 20 edge tiles.
    expect(cells).toHaveLength(20);
  });

  it('never floods interior rock cut off from the edge by a floor ring', () => {
    // A ring of floor at edgeDist 1 isolates the border rock from the inner rock.
    const g = grid(7, 7, 1, (m) => {
      for (let i = 1; i <= 5; i++) { m[1][i] = 0; m[5][i] = 0; m[i][1] = 0; m[i][5] = 0; }
    });
    const cells = moatCells(g, 7, 7, 3); // margin deep enough to reach the inner rock
    expect(has(cells, 0, 0)).toBe(true);   // border rock still floods
    expect(has(cells, 3, 3)).toBe(false);  // inner rock is unreachable through rock
    expect(cells.every((c) => Math.min(c.x, c.y, 6 - c.x, 6 - c.y) === 0)).toBe(true);
  });

  it('only flavours plain rock — breakable/cracked walls and other tiles are left', () => {
    const g = grid(5, 5, 1, (m) => { m[0][2] = 10; }); // a cracked wall on the border
    const cells = moatCells(g, 5, 5, 1);
    expect(has(cells, 2, 0)).toBe(false);  // the crack (10) is not flooded
    expect(has(cells, 0, 0)).toBe(true);   // neighbouring rock still is
  });

  it('returns nothing for degenerate inputs', () => {
    expect(moatCells(null, 5, 5, 2)).toEqual([]);
    expect(moatCells(grid(5, 5, 1), 5, 5, 0)).toEqual([]);
    expect(moatCells(grid(0, 0, 1), 0, 0, 2)).toEqual([]);
  });
});

describe('seaMargin', () => {
  it('scales gently with map size and never dips below 2', () => {
    expect(seaMargin(20, 20)).toBe(3);
    expect(seaMargin(24, 24)).toBe(3);
    expect(seaMargin(28, 28)).toBe(4);
    expect(seaMargin(32, 32)).toBe(4);
    expect(seaMargin(10, 10)).toBe(2); // clamped floor
  });
});
