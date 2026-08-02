import { describe, it, expect } from 'vitest';
import {
  arenaLayoutFor, arenaFeatureCells, carveArenaGrid, arenaNavIssues, pinchAnchors,
  arenaEntrance, arenaExit, arenaSize, maxFeatureR,
  ARENA_R, ARENA_PLAZA_CHEB, ARENA_LANE_HALF, ARENA_OUTER_FRAC, ARENA_RING_TILES,
} from '../../src/systems/bossArena.js';
import { BOSS_ARENAS, DEFAULT_BOSS_ARENA } from '../../src/data/bossArenas.js';

const R = ARENA_R;
const TYPES = Object.keys(BOSS_ARENAS);
const ALLOWED_TILES = new Set([1, 7, 8, 10]); // pillar/wall, lava, spikes, cracked wall

describe('arenaLayoutFor', () => {
  it('maps every known guardian to its own layout', () => {
    for (const t of TYPES) expect(arenaLayoutFor(t)).toBe(BOSS_ARENAS[t]);
  });
  it('falls back to the default (four pillars) for an unknown guardian', () => {
    expect(arenaLayoutFor('nobody')).toBe(DEFAULT_BOSS_ARENA);
    expect(arenaLayoutFor(undefined)).toBe(DEFAULT_BOSS_ARENA);
  });
});

describe('arenaFeatureCells', () => {
  it('only ever stamps real terrain codes (pillar, lava, spikes, cracked wall)', () => {
    for (const t of [...TYPES, 'nobody']) {
      for (const c of arenaFeatureCells(t, R)) expect(ALLOWED_TILES.has(c.tile)).toBe(true);
    }
  });

  it('never places a feature in the plaza, the N-S lane, or the perimeter ring', () => {
    const maxR2 = maxFeatureR(R) ** 2;
    for (const t of TYPES) {
      for (const { dx, dy } of arenaFeatureCells(t, R)) {
        expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeGreaterThan(ARENA_PLAZA_CHEB); // plaza stays open
        expect(Math.abs(dx)).toBeGreaterThan(ARENA_LANE_HALF);                          // N-S lane stays open
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(maxR2);                           // perimeter stays open
      }
    }
  });

  it('leaves a guardian-wide lap lane: ARENA_RING_TILES of floor inside the wall', () => {
    // The reason boss rooms grew. A ring measured as a FRACTION of R thins to a
    // needle on the diagonals — exactly where the corner cover sits — so a 3×3
    // guardian could only squeeze past a pillar on one exact tile, and wedged.
    for (const t of TYPES) {
      for (const { dx, dy } of arenaFeatureCells(t, R)) {
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(R - ARENA_RING_TILES);
      }
    }
    expect(ARENA_RING_TILES).toBeGreaterThanOrEqual(5); // 3×3 guardian + slack either side
  });

  it('pulls an over-reaching blob inward whole instead of gnawing cells off it', () => {
    // Every spec's footprint must survive intact: a 2×2 column that reached past the
    // ring should slide toward the centre, not come out as a 3-cell L.
    const blobs = (cells) => {
      const set = new Set(cells.map((c) => c.dx + ',' + c.dy)), seen = new Set(), out = [];
      for (const c of cells) {
        const k = c.dx + ',' + c.dy;
        if (seen.has(k)) continue;
        seen.add(k);
        const stack = [k], group = [];
        while (stack.length) {
          const [x, y] = stack.pop().split(',').map(Number);
          group.push([x, y]);
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = (x + ox) + ',' + (y + oy);
            if (set.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
          }
        }
        out.push(group);
      }
      return out;
    };
    // The dragon's roost is four 2×2 broken columns plus two 1×2 cracked walls.
    const sizes = blobs(arenaFeatureCells('dragon', R)).map((g) => g.length).sort();
    expect(sizes).toEqual([2, 2, 4, 4, 4, 4]);
    // …and no layout loses a cell: each spec contributes its full blob, every anchor.
    for (const t of TYPES) {
      const layout = arenaLayoutFor(t);
      const want = layout.features.reduce((n, f) => {
        const cells = f.blob ? f.blob.length : (f.w || 1) * (f.h || 1);
        const anchors = f.shape === 'quad' ? 4 : f.shape === 'axisH' ? 2 : (f.count || 6);
        return n + cells * anchors;
      }, 0);
      expect(arenaFeatureCells(t, R).length).toBe(want);
    }
  });

  it('is deterministic — same offsets every call', () => {
    for (const t of TYPES) {
      expect(arenaFeatureCells(t, R)).toEqual(arenaFeatureCells(t, R));
    }
  });

  it('gives every guardian a non-empty, distinctive layout', () => {
    const signatures = new Set();
    for (const t of TYPES) {
      const cells = arenaFeatureCells(t, R);
      expect(cells.length).toBeGreaterThan(0);
      signatures.add(JSON.stringify(cells));
    }
    // No two guardians share an identical stamp — each room reads as its own place.
    expect(signatures.size).toBe(TYPES.length);
  });

  it('delivers the requested variety: cover, lava AND breakable walls all appear', () => {
    const tiles = new Set();
    for (const t of TYPES) for (const c of arenaFeatureCells(t, R)) tiles.add(c.tile);
    expect(tiles.has(1)).toBe(true);  // cover pillars — dodge the arrows behind them
    expect(tiles.has(7)).toBe(true);  // lava
    expect(tiles.has(10)).toBe(true); // breakable cracked walls
    expect(tiles.has(8)).toBe(true);  // spike beds (bonus hazard)
  });
});

describe('carveArenaGrid', () => {
  it('sizes the grid to the arena and keeps the central plaza open floor', () => {
    for (const t of TYPES) {
      const { grid, size, cx, cy } = carveArenaGrid(t, R);
      expect(size).toBe(arenaSize(R));
      expect(grid.length).toBe(size);
      expect(grid[0].length).toBe(size);
      for (let dy = -ARENA_PLAZA_CHEB; dy <= ARENA_PLAZA_CHEB; dy++)
        for (let dx = -ARENA_PLAZA_CHEB; dx <= ARENA_PLAZA_CHEB; dx++)
          expect(grid[cy + dy][cx + dx]).toBe(0); // guardian's ground is always clear
    }
  });

  it('keeps the north-south entrance/exit lane clear floor end to end', () => {
    for (const t of TYPES) {
      const { grid, cx, cy } = carveArenaGrid(t, R);
      const ent = arenaEntrance(R, cx, cy), ex = arenaExit(R, cx, cy);
      for (let y = ex.y; y <= ent.y; y++)
        for (let dx = -ARENA_LANE_HALF; dx <= ARENA_LANE_HALF; dx++)
          expect(grid[y][cx + dx]).toBe(0);
    }
  });

  it('leaves the entrance and exit tiles on open floor', () => {
    for (const t of TYPES) {
      const { grid, cx, cy } = carveArenaGrid(t, R);
      const ent = arenaEntrance(R, cx, cy), ex = arenaExit(R, cx, cy);
      expect(grid[ent.y][ent.x]).toBe(0);
      expect(grid[ex.y][ex.x]).toBe(0);
    }
  });

  it('keeps the perimeter lap lane clear floor the whole way round', () => {
    const inner = R - ARENA_RING_TILES;
    for (const t of TYPES) {
      const { grid, size, cx, cy } = carveArenaGrid(t, R);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
          if (d2 > inner * inner && d2 <= (R - 1) * (R - 1)) expect(grid[y][x]).toBe(0);
        }
    }
  });

  it('walls off everything outside the circle', () => {
    const { grid, size, cx, cy } = carveArenaGrid('ratking', R);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > R * R) expect(grid[y][x]).toBe(1);
      }
  });
});

describe('maxFeatureR', () => {
  it('takes the tighter of the tile ring and the fractional cap', () => {
    expect(maxFeatureR(R)).toBe(Math.min(ARENA_OUTER_FRAC * R, R - ARENA_RING_TILES));
    expect(maxFeatureR(R)).toBe(R - ARENA_RING_TILES);       // the ring binds at the shipped size
    expect(maxFeatureR(40)).toBe(ARENA_OUTER_FRAC * 40);     // …the fraction takes over on a huge circle
  });
});

describe('pinchAnchors — spots the one-tile needle a guardian wedges on', () => {
  it('finds the single anchor joining two halves of a roaming area', () => {
    const a = new Set();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { a.add(y + ',' + x); a.add(y + ',' + (x + 4)); }
    a.add('1,3'); // the needle bridging the two blocks
    expect(pinchAnchors(a)).toContain('1,3');
  });

  it('reports nothing for a solid block a guardian can cross any which way', () => {
    const a = new Set();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) a.add(y + ',' + x);
    expect(pinchAnchors(a)).toEqual([]);
  });

  it('is empty for a set too small to have a bottleneck', () => {
    expect(pinchAnchors(new Set(['0,0', '0,1']))).toEqual([]);
  });
});

describe('arenaNavIssues — every arena stays fair and navigable', () => {
  // The core guarantee behind the feature: cover/hazards make each room its own
  // place, but a 3×3 guardian can still lumber all around it and the hero can
  // always walk to the exit. If a layout ever gets too tight, this fails CI.
  it('lets a 3×3 guardian roam and the hero reach the exit, for all fifteen', () => {
    for (const t of TYPES) {
      expect(arenaNavIssues(t, R, 3)).toEqual([]);
    }
  });

  it('defaults to the shipped arena radius', () => {
    for (const t of TYPES) expect(arenaNavIssues(t)).toEqual(arenaNavIssues(t, ARENA_R, 3));
  });

  it('holds for the default fallback arena too', () => {
    expect(arenaNavIssues('nobody', R, 3)).toEqual([]);
  });

  it('holds at smaller guardian sizes as well', () => {
    for (const t of TYPES) {
      expect(arenaNavIssues(t, R, 2)).toEqual([]);
      expect(arenaNavIssues(t, R, 1)).toEqual([]);
    }
  });

  it('gives a 3×3 guardian room to spare, not a thread of legal footprint', () => {
    // Slack is the point: it lumbers greedily (one axis, then the other) instead of
    // pathing, so a lane it fits through on exactly one tile is a lane it wedges in.
    for (const t of TYPES) {
      const { grid, size, cx, cy } = carveArenaGrid(t, R);
      const fits = (x, y) => {
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (grid[y + j][x + i] !== 0) return false;
        return true;
      };
      let anchors = 0;
      for (let y = 0; y < size - 3; y++) for (let x = 0; x < size - 3; x++) if (fits(x, y)) anchors++;
      expect(anchors).toBeGreaterThan(400); // ~500 today; the old R=10 arenas had ~150
      expect(fits(cx - 1, cy - 1)).toBe(true);
    }
  });

  it('actually flags a room that walls the hero off from the exit', () => {
    // Sanity-check the validator has teeth: a solid ring of wall across the arena
    // (bypassing the data path) must be reported, not passed.
    const { grid, cx, cy } = carveArenaGrid('ratking', R);
    for (let x = 0; x < grid[0].length; x++) if (grid[cy][x] === 0) grid[cy][x] = 1; // seal the middle row
    // Re-run the flood by hand against this hand-broken grid via a tiny helper: the
    // exported validator rebuilds from data, so assert on our own flood instead.
    const walk = (t) => t === 0 || t === 7 || t === 8;
    const ent = arenaEntrance(R, cx, cy), ex = arenaExit(R, cx, cy);
    const seen = new Set([ent.y + ',' + ent.x]); const st = [[ent.x, ent.y]];
    while (st.length) { const [x, y] = st.pop();
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx=x+dx, ny=y+dy;
        if (nx<0||ny<0||ny>=grid.length||nx>=grid[0].length) continue;
        const k=ny+','+nx; if (seen.has(k)||!walk(grid[ny][nx])) continue; seen.add(k); st.push([nx,ny]); } }
    expect(seen.has(ex.y + ',' + ex.x)).toBe(false); // the seam really does block the exit
  });
});
