import { describe, it, expect } from 'vitest';
import { pickVaultRoom, findSealedRoom } from '../../src/systems/vaultRooms.js';
import { VAULT_ROOMS } from '../../src/data/vaultRooms.js';
import { mulberry32 } from '../../src/utils/rng.js';

// findSealedRoom carves a room out of solid rock reachable only through one door.
// The grids below are ASCII maps: '#' = rock (1), '.' = open floor (0). We build a
// numeric mapData + an isReachable predicate and assert the placement is genuinely
// sealed — every returned cell was rock, and the door bridges the room to floor.
function grid(rows) {
  const mapData = rows.map(r => [...r].map(ch => (ch === '#' ? 1 : 0)));
  const H = rows.length, W = rows[0].length;
  const isReachable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mapData[y][x] === 0;
  return { mapData, W, H, isReachable };
}

// A mostly-rock map with a single floor corridor along the middle row — plenty of
// rock to seat a room whose door drops onto the corridor.
const ROCK_WITH_CORRIDOR = [
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
  '#............#',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
];

describe('findSealedRoom', () => {
  it('carves a room of the requested size out of solid rock', () => {
    const { mapData, isReachable } = grid(ROCK_WITH_CORRIDOR);
    const place = findSealedRoom(mapData, isReachable, 3, 3, mulberry32(1));
    expect(place).not.toBeNull();
    expect(place.w).toBe(3);
    expect(place.h).toBe(3);
    expect(place.cells).toHaveLength(9);
  });

  it('only ever carves cells that were solid rock (the room is dug, not stolen from floor)', () => {
    const { mapData, isReachable } = grid(ROCK_WITH_CORRIDOR);
    for (let seed = 1; seed <= 40; seed++) {
      const place = findSealedRoom(mapData, isReachable, 3, 3, mulberry32(seed));
      if (!place) continue;
      for (const c of place.cells) expect(mapData[c.y][c.x]).toBe(1);
      expect(mapData[place.door.y][place.door.x]).toBe(1); // the door tile was rock too
    }
  });

  it('seats the door so it bridges the sealed room to reachable floor', () => {
    const { mapData, isReachable } = grid(ROCK_WITH_CORRIDOR);
    const place = findSealedRoom(mapData, isReachable, 3, 3, mulberry32(7));
    expect(place).not.toBeNull();
    const { rx, ry, w, h, door } = place;
    // The door hugs exactly one edge of the rectangle…
    const onTop = door.y === ry - 1, onBottom = door.y === ry + h;
    const onLeft = door.x === rx - 1, onRight = door.x === rx + w;
    expect(onTop || onBottom || onLeft || onRight).toBe(true);
    // …and the tile one step further OUT (away from the room) is reachable floor.
    const out = onTop ? { x: door.x, y: ry - 2 }
      : onBottom ? { x: door.x, y: ry + h + 1 }
      : onLeft ? { x: rx - 2, y: door.y }
      : { x: rx + w + 1, y: door.y };
    expect(mapData[out.y][out.x]).toBe(0);
  });

  it('does not mutate the input map (pure — the caller applies the carve)', () => {
    const { mapData, isReachable } = grid(ROCK_WITH_CORRIDOR);
    const before = JSON.stringify(mapData);
    findSealedRoom(mapData, isReachable, 3, 3, mulberry32(3));
    expect(JSON.stringify(mapData)).toBe(before);
  });

  it('is deterministic for a given seed', () => {
    const a = grid(ROCK_WITH_CORRIDOR);
    const b = grid(ROCK_WITH_CORRIDOR);
    expect(findSealedRoom(a.mapData, a.isReachable, 3, 3, mulberry32(9)))
      .toEqual(findSealedRoom(b.mapData, b.isReachable, 3, 3, mulberry32(9)));
  });

  it('returns null when there is no rock to carve into', () => {
    const allFloor = Array.from({ length: 12 }, () => '.'.repeat(12));
    const { mapData, isReachable } = grid(allFloor);
    expect(findSealedRoom(mapData, isReachable, 3, 3, mulberry32(1))).toBeNull();
  });

  it('returns null when the map is too small to fit the room plus its rock ring', () => {
    const tiny = grid(['#####', '#####', '#####', '#####', '#####']);
    expect(findSealedRoom(tiny.mapData, tiny.isReachable, 3, 3, mulberry32(1))).toBeNull();
  });

  it('finds no door when the rock block never touches reachable floor', () => {
    // A big rock slab with a lone floor tile fully walled off — nothing to bridge to.
    const sealedOff = grid([
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
    ]);
    expect(findSealedRoom(sealedOff.mapData, sealedOff.isReachable, 3, 3, mulberry32(1))).toBeNull();
  });
});

describe('pickVaultRoom', () => {
  const ids = new Set(VAULT_ROOMS.map(v => v.id));

  it('always returns a real vault flavour', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const v = pickVaultRoom(mulberry32(seed), { deepOK: true });
      expect(ids.has(v.id)).toBe(true);
    }
  });

  it('rng at 0 lands on the first flavour in the pool', () => {
    expect(pickVaultRoom(() => 0, { deepOK: true }).id).toBe(VAULT_ROOMS[0].id);
  });

  it('never offers the express stair when there is no room to descend', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const v = pickVaultRoom(mulberry32(seed), { deepOK: false });
      expect(v.needsDeep).toBeFalsy();
    }
  });

  it('can offer the express stair when descent is allowed', () => {
    let sawDeep = false;
    for (let seed = 1; seed <= 200 && !sawDeep; seed++) {
      if (pickVaultRoom(mulberry32(seed), { deepOK: true }).kind === 'deepstair') sawDeep = true;
    }
    expect(sawDeep).toBe(true);
  });
});
