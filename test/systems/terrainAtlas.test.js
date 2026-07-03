import { describe, it, expect } from 'vitest';
import {
  CORNER_BITS,
  cornerMask,
  terrainHash,
  resolveTileId,
  atlasId,
  atlasColRow,
  blobTemplateToRole,
  packRoleIntoAtlas,
} from '../../src/systems/terrainAtlas.js';

describe('cornerMask', () => {
  it('assigns the documented bits (NW=8, NE=4, SW=2, SE=1)', () => {
    expect(cornerMask(1, 0, 0, 0)).toBe(CORNER_BITS.NW);
    expect(cornerMask(0, 1, 0, 0)).toBe(CORNER_BITS.NE);
    expect(cornerMask(0, 0, 1, 0)).toBe(CORNER_BITS.SW);
    expect(cornerMask(0, 0, 0, 1)).toBe(CORNER_BITS.SE);
  });
  it('empty and full corners are 0 and 15', () => {
    expect(cornerMask(0, 0, 0, 0)).toBe(0);
    expect(cornerMask(1, 1, 1, 1)).toBe(15);
  });
  it('coerces truthy/falsy corner values', () => {
    expect(cornerMask(true, false, 'x', 0)).toBe(CORNER_BITS.NW | CORNER_BITS.SW);
  });
});

describe('terrainHash', () => {
  it('is deterministic and unsigned', () => {
    const h = terrainHash(3, 7);
    expect(h).toBe(terrainHash(3, 7));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
  it('varies with position', () => {
    expect(terrainHash(3, 7)).not.toBe(terrainHash(7, 3));
  });
});

describe('atlas index math', () => {
  it('round-trips id <-> (col,row) for a 32-wide atlas', () => {
    expect(atlasId(5, 3, 32)).toBe(3 * 32 + 5);
    expect(atlasColRow(101, 32)).toEqual({ col: 101 % 32, row: 3 });
  });
});

describe('resolveTileId', () => {
  const table = { 7: 258, 15: 321 };
  it('mask 0 paints nothing', () => {
    expect(resolveTileId(table, [], 0, 0, 0)).toBeNull();
  });
  it('a transition mask uses the table', () => {
    expect(resolveTileId(table, [], 7, 1, 1)).toBe(258);
  });
  it('missing transition returns null', () => {
    expect(resolveTileId(table, [], 3, 1, 1)).toBeNull();
    expect(resolveTileId(null, [], 3, 1, 1)).toBeNull();
  });
  it('interior mask 15 with no fills uses table[15]', () => {
    expect(resolveTileId(table, [], 15, 4, 4)).toBe(321);
    expect(resolveTileId({}, null, 15, 4, 4)).toBeNull();
  });
  it('interior mask 15 scatters fill variants deterministically', () => {
    const fills = [321, 401, 402, 403];
    const a = resolveTileId(table, fills, 15, 4, 4);
    expect(fills).toContain(a);
    expect(resolveTileId(table, fills, 15, 4, 4)).toBe(a); // stable per cell
    // Enough cells hit more than one variant (not a constant).
    const seen = new Set();
    for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) seen.add(resolveTileId(table, fills, 15, x, y));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('blobTemplateToRole', () => {
  it('maps template cells to source ids and derives a fill from the interior', () => {
    const role = blobTemplateToRole({ 7: [2, 0], 15: [1, 1] }, 4);
    expect(role.table[7]).toBe(atlasId(2, 0, 4)); // 2
    expect(role.table[15]).toBe(atlasId(1, 1, 4)); // 5
    expect(role.fills).toEqual([5]); // interior doubles as first fill
  });
  it('honours explicit fill variants and skips omitted transitions', () => {
    const role = blobTemplateToRole({ 15: [0, 0], fills: [[0, 0], [1, 0], [2, 0]] }, 8);
    expect(role.table[7]).toBeUndefined();
    expect(role.fills).toEqual([0, 1, 2]);
  });
  it('validates its inputs', () => {
    expect(() => blobTemplateToRole(null, 4)).toThrow();
    expect(() => blobTemplateToRole({}, 0)).toThrow();
  });
  it('yields no fills when the template has no interior and none listed', () => {
    const role = blobTemplateToRole({ 7: [1, 0] }, 4);
    expect(role.fills).toEqual([]);
  });

  // Fidelity: rebuild the game's real LPC "Grass" role from its own tile ids and
  // confirm the converter reproduces them exactly — the imported-pack path and
  // the shipping path agree on identical geometry.
  it('reproduces the bundled LPC Grass role id-for-id', () => {
    const GRASS = { 1: 288, 2: 290, 3: 289, 4: 352, 5: 320, 6: 416, 7: 258,
      8: 354, 9: 417, 10: 322, 11: 257, 12: 353, 13: 226, 14: 225, 15: 321 };
    const COLS = 32;
    const template = {};
    for (let m = 1; m <= 15; m++) { const { col, row } = atlasColRow(GRASS[m], COLS); template[m] = [col, row]; }
    const role = blobTemplateToRole(template, COLS);
    expect(role.table).toEqual(GRASS);
    expect(role.fills).toEqual([321]);
  });
});

describe('packRoleIntoAtlas', () => {
  it('appends tiles contiguously and records the pixel copies', () => {
    const role = { table: { 7: 258, 15: 321 }, fills: [321, 401] };
    const state = { cols: 32, nextId: 2048 };
    const packed = packRoleIntoAtlas(role, state);
    expect(packed.table[7]).toBe(2048);
    expect(packed.table[15]).toBe(2049);
    // 321 already relocated (as table[15]) is reused, not copied twice.
    expect(packed.fills).toEqual([2049, 2050]);
    expect(packed.blits).toEqual([
      { src: 258, dst: 2048 },
      { src: 321, dst: 2049 },
      { src: 401, dst: 2050 },
    ]);
    expect(state.nextId).toBe(2051);
  });
  it('drops null transitions and null fills without allocating', () => {
    const role = { table: { 7: null, 15: 500 }, fills: [null, 500] };
    const state = { cols: 32, nextId: 100 };
    const packed = packRoleIntoAtlas(role, state);
    expect(packed.table).toEqual({ 15: 100 });
    expect(packed.fills).toEqual([null, 100]); // null fill stays null; 500 reuses its id
    expect(state.nextId).toBe(101);
  });
});
