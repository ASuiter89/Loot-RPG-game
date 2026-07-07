import { describe, it, expect } from 'vitest';
import {
  expandPaths, townObjects, nearestInteractable, pickDecorVariant,
  reachableTiles, isApproachable,
} from '../../src/systems/townLayout.js';
import {
  TOWN_W, TOWN_H, TOWN_SPAWN, TOWN_STATUE, TOWN_GATE, TOWN_PORTAL,
  TOWN_PATHS, TOWN_NPCS, TOWN_DECOR, TOWN_DECOR_FAMILIES,
} from '../../src/data/townLayout.js';

describe('expandPaths', () => {
  it('expands a rect into its tile keys', () => {
    const s = expandPaths([{ x: 2, y: 3, w: 2, h: 2 }]);
    expect(s).toEqual(new Set(['2,3', '3,3', '2,4', '3,4']));
  });
  it('unions overlapping rects without duplication', () => {
    const s = expandPaths([{ x: 0, y: 0, w: 2, h: 1 }, { x: 1, y: 0, w: 2, h: 1 }]);
    expect([...s].sort()).toEqual(['0,0', '1,0', '2,0']);
  });
  it('returns an empty set for no rects', () => {
    expect(expandPaths([]).size).toBe(0);
  });
});

describe('townObjects', () => {
  const npcs = [{ x: 1, y: 1, kind: 'healer', name: 'Healer' }];
  const gate = { x: 5, y: 0, name: 'Dungeon Gate' };
  const portal = { x: 2, y: 9, name: 'Town Portal' };

  it('always includes the npcs and the gate', () => {
    const objs = townObjects(npcs, gate, portal, false);
    expect(objs).toHaveLength(2);
    expect(objs.find((o) => o.type === 'gate')).toMatchObject({ x: 5, y: 0, kind: 'gate' });
    expect(objs.find((o) => o.kind === 'healer').type).toBe('npc');
  });
  it('adds the portal ONLY when a floor is held', () => {
    expect(townObjects(npcs, gate, portal, false).some((o) => o.type === 'portal')).toBe(false);
    const held = townObjects(npcs, gate, portal, true);
    expect(held.some((o) => o.type === 'portal')).toBe(true);
    expect(held.find((o) => o.type === 'portal')).toMatchObject({ x: 2, y: 9, kind: 'portal' });
  });
});

describe('nearestInteractable', () => {
  const objs = [
    { x: 5, y: 5, kind: 'a' },
    { x: 6, y: 5, kind: 'b' },
    { x: 5, y: 7, kind: 'c' },
  ];
  it('finds an adjacent object within Chebyshev 1 (incl. diagonal)', () => {
    expect(nearestInteractable(6, 6, objs).kind).toBe('b'); // (6,5) is closest (dist²=1)
    expect(nearestInteractable(7, 6, objs).kind).toBe('b'); // (6,5) is the only one within 1
    expect(nearestInteractable(5, 8, objs).kind).toBe('c'); // (5,7) is the only one within 1
  });
  it('returns null when nothing is in range', () => {
    expect(nearestInteractable(0, 0, objs)).toBeNull();
  });
  it('picks the closest by Euclidean distance among in-range objects', () => {
    // standing at (5,5): 'a' same tile (0), 'b' at dist 1 → 'a' wins
    expect(nearestInteractable(5, 5, objs).kind).toBe('a');
    // between a and b, a hair closer to b
    expect(nearestInteractable(6, 5, objs).kind).toBe('b');
  });
  it('honours a custom range', () => {
    expect(nearestInteractable(5, 5, [{ x: 7, y: 5, kind: 'far' }], 1)).toBeNull();
    expect(nearestInteractable(5, 5, [{ x: 7, y: 5, kind: 'far' }], 2).kind).toBe('far');
  });
});

describe('pickDecorVariant', () => {
  it('is deterministic for a given tile', () => {
    const ids = [10, 11, 12, 13];
    expect(pickDecorVariant(ids, 4, 7)).toBe(pickDecorVariant(ids, 4, 7));
  });
  it('stays within the id list', () => {
    const ids = [10, 11, 12];
    for (let x = 0; x < 30; x++) for (let y = 0; y < 22; y++) expect(ids).toContain(pickDecorVariant(ids, x, y));
  });
  it('varies across tiles (not a constant)', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7];
    const seen = new Set();
    for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) seen.add(pickDecorVariant(ids, x, y));
    expect(seen.size).toBeGreaterThan(1);
  });
  it('returns null for an empty or missing list', () => {
    expect(pickDecorVariant([], 1, 1)).toBeNull();
    expect(pickDecorVariant(null, 1, 1)).toBeNull();
  });
  it('handles a single-element list', () => {
    expect(pickDecorVariant([42], 3, 9)).toBe(42);
  });
});

describe('reachableTiles / isApproachable', () => {
  it('floods an open grid fully', () => {
    const reach = reachableTiles(new Set(), 3, 3, { x: 0, y: 0 });
    expect(reach.size).toBe(9);
  });
  it('respects blocked tiles and walls off pockets', () => {
    // a vertical wall at x=1 splits a 3x3 grid; from (0,0) only the left column is reachable
    const blocked = new Set(['1,0', '1,1', '1,2']);
    const reach = reachableTiles(blocked, 3, 3, { x: 0, y: 0 });
    expect(reach).toEqual(new Set(['0,0', '0,1', '0,2']));
  });
  it('isApproachable is true iff an orthogonal neighbour is reachable', () => {
    const reach = new Set(['0,0', '1,0']);
    expect(isApproachable({ x: 2, y: 0 }, reach)).toBe(true); // (1,0) neighbours it
    expect(isApproachable({ x: 5, y: 5 }, reach)).toBe(false);
  });
});

// ── Authored-data validity: these guard the hand-placed town against a bad edit ──
describe('authored town data', () => {
  const key = (x, y) => x + ',' + y;
  const isBorder = (x, y) => x === 0 || y === 0 || x === TOWN_W - 1 || y === TOWN_H - 1;

  it('has sane dimensions and in-bounds anchors', () => {
    expect(TOWN_W).toBeGreaterThanOrEqual(20);
    expect(TOWN_H).toBeGreaterThanOrEqual(20);
    for (const p of [TOWN_SPAWN, TOWN_STATUE, TOWN_GATE, TOWN_PORTAL]) {
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(TOWN_W - 1);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(TOWN_H - 1);
    }
  });

  it('places every service keeper on a unique interior tile', () => {
    const seen = new Set();
    for (const n of TOWN_NPCS) {
      expect(isBorder(n.x, n.y)).toBe(false);
      expect(seen.has(key(n.x, n.y))).toBe(false);
      seen.add(key(n.x, n.y));
      expect(typeof n.kind).toBe('string');
      expect(typeof n.name).toBe('string');
    }
  });

  it('covers the full service roster (no keeper missing, none doubled)', () => {
    const kinds = TOWN_NPCS.map((n) => n.kind);
    const expected = [
      'forge', 'enchanter', 'transmuter', 'mirrorforge', 'merchant', 'gambler', 'ramen',
      'mystic', 'covenants', 'weave', 'pantheon', 'healer', 'trainer', 'bounty', 'deeds',
      'cycles', 'stash', 'sellsword',
    ];
    expect(kinds.slice().sort()).toEqual(expected.slice().sort());
  });

  it('never puts a decoration on a keeper, the spawn, or a special object', () => {
    const occupied = new Set([
      ...TOWN_NPCS.map((n) => key(n.x, n.y)),
      key(TOWN_SPAWN.x, TOWN_SPAWN.y), key(TOWN_STATUE.x, TOWN_STATUE.y),
      key(TOWN_GATE.x, TOWN_GATE.y), key(TOWN_PORTAL.x, TOWN_PORTAL.y),
    ]);
    for (const d of TOWN_DECOR) {
      expect(occupied.has(key(d.x, d.y))).toBe(false);
      expect(TOWN_DECOR_FAMILIES[d.c]).toBeDefined();
      expect(isBorder(d.x, d.y)).toBe(false);
    }
  });

  it('keeps every keeper, the gate and the portal reachable from the spawn', () => {
    // Blocked = border walls + the statue + solid decor (treated as its 1 anchor
    // tile) + keeper tiles. The hero must be able to reach a tile ADJACENT to each
    // keeper/gate/portal, or the service is unusable.
    const blocked = new Set();
    for (let x = 0; x < TOWN_W; x++) for (let y = 0; y < TOWN_H; y++) if (isBorder(x, y)) blocked.add(key(x, y));
    blocked.add(key(TOWN_STATUE.x, TOWN_STATUE.y));
    for (const d of TOWN_DECOR) if (TOWN_DECOR_FAMILIES[d.c].solid) blocked.add(key(d.x, d.y));
    for (const n of TOWN_NPCS) blocked.add(key(n.x, n.y));

    const reach = reachableTiles(blocked, TOWN_W, TOWN_H, TOWN_SPAWN);
    const objs = townObjects(TOWN_NPCS, TOWN_GATE, TOWN_PORTAL, true);
    for (const o of objs) {
      expect(isApproachable(o, reach)).toBe(true);
    }
  });

  it('leaves the spawn tile itself walkable (no decor/statue on it)', () => {
    const solidAt = new Set(TOWN_DECOR.filter((d) => TOWN_DECOR_FAMILIES[d.c].solid).map((d) => key(d.x, d.y)));
    expect(solidAt.has(key(TOWN_SPAWN.x, TOWN_SPAWN.y))).toBe(false);
    expect(key(TOWN_SPAWN.x, TOWN_SPAWN.y)).not.toBe(key(TOWN_STATUE.x, TOWN_STATUE.y));
  });
});
