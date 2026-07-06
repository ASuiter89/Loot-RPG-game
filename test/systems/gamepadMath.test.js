import { describe, it, expect } from 'vitest';
import {
  padStickVector, stickToDir, edgePressed, edgeReleased,
  pickInDirection, readingOrder, PAD_DEFAULTS,
} from '../../src/systems/gamepadMath.js';

// Box helper: {left,right,top,bottom} from x,y,w,h.
const box = (x, y, w = 40, h = 20) => ({ left: x, right: x + w, top: y, bottom: y + h });

describe('padStickVector', () => {
  it('is zero at rest (centre)', () => {
    expect(padStickVector(0, 0)).toEqual({ ix: 0, iy: 0, mag: 0 });
  });
  it('ignores small drift inside the dead-zone', () => {
    const v = padStickVector(0.1, 0.1, 0.22);
    expect(v).toEqual({ ix: 0, iy: 0, mag: 0 });
  });
  it('eases out of the dead-zone with no jump at the edge', () => {
    const v = padStickVector(0.23, 0, 0.22);   // just past the zone on +x
    expect(v.mag).toBeGreaterThan(0);
    expect(v.mag).toBeLessThan(0.05);
    expect(v.ix).toBeCloseTo(v.mag, 10);       // pure +x direction
    expect(v.iy).toBe(0);
  });
  it('points in the pushed direction and preserves down = +y', () => {
    const up = padStickVector(0, -1, 0.22);
    expect(up.iy).toBeLessThan(0);
    const down = padStickVector(0, 1, 0.22);
    expect(down.iy).toBeGreaterThan(0);
  });
  it('clamps an over-range push to magnitude 1', () => {
    const v = padStickVector(1, 1, 0);          // corner, no dead-zone
    expect(v.mag).toBeCloseTo(1, 10);
    expect(Math.hypot(v.ix, v.iy)).toBeCloseTo(1, 10);
  });
  it('full push on one axis reads full magnitude', () => {
    const v = padStickVector(1, 0, 0.22);
    expect(v.mag).toBeCloseTo(1, 10);
    expect(v.ix).toBeCloseTo(1, 10);
  });
});

describe('stickToDir', () => {
  it('is null inside the threshold', () => {
    expect(stickToDir(0, 0)).toBe(null);
    expect(stickToDir(0.3, 0.3, 0.5)).toBe(null);
  });
  it('picks the dominant axis', () => {
    expect(stickToDir(0.9, 0.1)).toBe('right');
    expect(stickToDir(-0.9, 0.1)).toBe('left');
    expect(stickToDir(0.1, 0.9)).toBe('down');
    expect(stickToDir(0.1, -0.9)).toBe('up');
  });
  it('breaks a 45° tie toward the horizontal axis', () => {
    expect(stickToDir(0.8, 0.8)).toBe('right');
    expect(stickToDir(-0.8, -0.8)).toBe('left');
  });
});

describe('edge detection', () => {
  it('reports only rising edges', () => {
    expect(edgePressed([false, true, false], [true, true, true])).toEqual([0, 2]);
    expect(edgePressed([true, true], [true, true])).toEqual([]);
  });
  it('reports only falling edges', () => {
    expect(edgeReleased([true, true, false], [false, true, false])).toEqual([0]);
    expect(edgeReleased([false, false], [true, true])).toEqual([]);
  });
  it('a full press-then-release fires each edge once', () => {
    const rest = [false];
    const held = [true];
    expect(edgePressed(rest, held)).toEqual([0]);
    expect(edgePressed(held, held)).toEqual([]);   // still held → no re-fire
    expect(edgeReleased(held, rest)).toEqual([0]);
  });
});

describe('pickInDirection — vertical list', () => {
  // Three stacked buttons, same column.
  const list = [box(0, 0), box(0, 30), box(0, 60)];
  it('down moves to the next item below', () => {
    expect(pickInDirection(list[0], list, 'down')).toBe(1);
    expect(pickInDirection(list[1], list, 'down')).toBe(2);
  });
  it('up moves to the previous item above', () => {
    expect(pickInDirection(list[2], list, 'up')).toBe(1);
    expect(pickInDirection(list[0], list, 'up')).toBe(-1);   // nothing above the top
  });
  it('picks the NEAREST below, not just any below', () => {
    expect(pickInDirection(list[0], list, 'down')).toBe(1);  // 1 is nearer than 2
  });
  it('left/right find nothing in a single column', () => {
    expect(pickInDirection(list[1], list, 'left')).toBe(-1);
    expect(pickInDirection(list[1], list, 'right')).toBe(-1);
  });
});

describe('pickInDirection — horizontal tab strip', () => {
  const tabs = [box(0, 0), box(50, 0), box(100, 0)];
  it('right/left walk the strip', () => {
    expect(pickInDirection(tabs[0], tabs, 'right')).toBe(1);
    expect(pickInDirection(tabs[2], tabs, 'left')).toBe(1);
  });
  it('stops at the ends', () => {
    expect(pickInDirection(tabs[2], tabs, 'right')).toBe(-1);
    expect(pickInDirection(tabs[0], tabs, 'left')).toBe(-1);
  });
});

describe('pickInDirection — 2×3 grid prefers aligned cells', () => {
  // col0        col1
  const grid = [
    box(0, 0),   box(50, 0),    // row 0: 0,1
    box(0, 30),  box(50, 30),   // row 1: 2,3
    box(0, 60),  box(50, 60),   // row 2: 4,5
  ];
  it('right stays in the same row', () => {
    expect(pickInDirection(grid[2], grid, 'right')).toBe(3);
  });
  it('down stays in the same column even though a diagonal cell is close', () => {
    // From cell 0, cell 3 (diagonal) is closer by raw distance than cell 2, but the
    // cross-axis penalty keeps focus in column 0.
    expect(pickInDirection(grid[0], grid, 'down')).toBe(2);
  });
  it('up from the middle-right returns the top-right', () => {
    expect(pickInDirection(grid[3], grid, 'up')).toBe(1);
  });
  it('travels diagonally only when nothing is aligned', () => {
    // A lone cell up-and-to-the-right of the anchor, nothing directly right.
    const sparse = [box(0, 100), box(80, 0)];
    expect(pickInDirection(sparse[0], sparse, 'right')).toBe(1);
    expect(pickInDirection(sparse[0], sparse, 'up')).toBe(1);
  });
});

describe('pickInDirection — alignment strictly beats proximity (the diagonal bug)', () => {
  // A horizontal tab strip: [Active][Passive], with a class option "Duelist" one row
  // down and only slightly to the right of Active. "→" from Active must land on
  // Passive (aligned, same row) — NOT Duelist, even though Duelist is nearer in x.
  const active = box(0, 0, 60, 20);
  const passive = box(80, 0, 60, 20);       // same row, far to the right
  const duelist = box(10, 30, 60, 20);      // next row, only slightly right
  it('→ from a tab picks the aligned tab beside it, not the closer item below', () => {
    const cands = [active, passive, duelist];
    expect(pickInDirection(active, cands, 'right')).toBe(1);   // passive, not duelist
  });
  it('↓ from the tab still reaches the row below', () => {
    const cands = [active, passive, duelist];
    expect(pickInDirection(active, cands, 'down')).toBe(2);    // duelist
  });
  it('a slightly-misaligned same-row neighbour still beats a far aligned one', () => {
    // near neighbour overlaps the row (cross 0) though its top differs by a few px;
    // a far element in perfect alignment must not steal focus from the near one.
    const cur = box(0, 0, 40, 20);
    const near = box(50, 3, 40, 20);     // overlaps rows (cross 0), close
    const far = box(300, 0, 40, 20);     // perfectly aligned but far
    expect(pickInDirection(cur, [cur, near, far], 'right')).toBe(1);
  });
});

describe('pickInDirection — edge cases', () => {
  it('ignores holes (null candidates) from filtered-out elements', () => {
    const list = [box(0, 0), null, box(0, 60)];
    expect(pickInDirection(list[0], list, 'down')).toBe(2);
  });
  it('does not pick the current element itself (zero primary displacement)', () => {
    const one = box(0, 0);
    expect(pickInDirection(one, [one], 'down')).toBe(-1);
  });
});

describe('readingOrder', () => {
  it('sorts top-to-bottom then left-to-right', () => {
    const rects = [box(50, 0), box(0, 0), box(0, 40), box(50, 40)];
    expect(readingOrder(rects)).toEqual([1, 0, 2, 3]);
  });
  it('treats near-equal tops as the same row (within tolerance)', () => {
    const rects = [box(50, 2), box(0, 0)];   // 2px apart vertically → same row, sort by left
    expect(readingOrder(rects, 12)).toEqual([1, 0]);
  });
});

describe('PAD_DEFAULTS', () => {
  it('exposes the tuning constants', () => {
    expect(PAD_DEFAULTS.moveDeadZone).toBeGreaterThan(0);
    expect(PAD_DEFAULTS.navThreshold).toBeGreaterThan(0);
    expect(PAD_DEFAULTS.crossPenalty).toBeGreaterThanOrEqual(1);
  });
});
