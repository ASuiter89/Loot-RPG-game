import { describe, it, expect } from 'vitest';
import {
  expandPaths, townObjects, nearestInteractable, pickDecorVariant,
  reachableTiles, isApproachable, inSanctum,
} from '../../src/systems/townLayout.js';
import {
  TOWN_W, TOWN_H, TOWN_SPAWN, TOWN_GATE, TOWN_PORTAL,
  TOWN_PATHS, TOWN_NPCS, TOWN_DECOR, TOWN_DECOR_FAMILIES,
  TOWN_SANCTUM, TOWN_ENDGAME_KINDS, TOWN_FIXED_KINDS, TOWN_SERVICE_ARRIVALS,
} from '../../src/data/townLayout.js';
import { DECOR_INDEX } from '../../src/assets/decorAtlas.js';

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
    expect(nearestInteractable(5, 5, objs).kind).toBe('a');
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

describe('inSanctum', () => {
  const b = { x0: 3, y0: 3, x1: 11, y1: 10 };
  it('is true on the corners and interior of the inclusive box', () => {
    expect(inSanctum(3, 3, b)).toBe(true);
    expect(inSanctum(11, 10, b)).toBe(true);
    expect(inSanctum(7, 7, b)).toBe(true);
  });
  it('is false just outside every edge', () => {
    expect(inSanctum(2, 5, b)).toBe(false);   // west of x0
    expect(inSanctum(12, 5, b)).toBe(false);  // east of x1
    expect(inSanctum(7, 2, b)).toBe(false);   // north of y0
    expect(inSanctum(7, 11, b)).toBe(false);  // south of y1
  });
});

describe('reachableTiles / isApproachable', () => {
  it('floods an open grid fully', () => {
    const reach = reachableTiles(new Set(), 3, 3, { x: 0, y: 0 });
    expect(reach.size).toBe(9);
  });
  it('respects blocked tiles and walls off pockets', () => {
    const blocked = new Set(['1,0', '1,1', '1,2']);
    const reach = reachableTiles(blocked, 3, 3, { x: 0, y: 0 });
    expect(reach).toEqual(new Set(['0,0', '0,1', '0,2']));
  });
  it('isApproachable is true iff an orthogonal neighbour is reachable', () => {
    const reach = new Set(['0,0', '1,0']);
    expect(isApproachable({ x: 2, y: 0 }, reach)).toBe(true);
    expect(isApproachable({ x: 5, y: 5 }, reach)).toBe(false);
  });
});

// ── Authored-camp validity: guard the hand-placed campsite against a bad edit,
// resolving decor EXACTLY as buildTown does (id or family via pickDecorVariant) so
// the connectivity check reflects the tiles the game will actually block. ──────────
describe('authored town data', () => {
  const key = (x, y) => x + ',' + y;
  const isBorder = (x, y) => x === 0 || y === 0 || x === TOWN_W - 1 || y === TOWN_H - 1;
  // Mirror of decorFootprint's 'all' branch (bottom-centre anchored); 'base'/'none' → anchor.
  const footprint = (id, ax, ay) => {
    const d = DECOR_INDEX[id];
    if (!d || d.block === 'none' || d.block === 'base') return [[ax, ay]];
    const W = Math.max(1, Math.round(d.w / 32)), Hh = Math.max(1, Math.round(d.ht));
    const left = ax - (W >> 1), top = ay - (Hh - 1), t = [];
    for (let yy = top; yy <= ay; yy++) for (let xx = left; xx < left + W; xx++) t.push([xx, yy]);
    return t;
  };
  const resolve = (d) => {
    const id = d.id != null ? d.id : pickDecorVariant(TOWN_DECOR_FAMILIES[d.c].ids, d.x, d.y);
    const solid = d.id != null ? DECOR_INDEX[id].block !== 'none' : TOWN_DECOR_FAMILIES[d.c].solid;
    return { id, solid, foot: solid ? footprint(id, d.x, d.y) : [[d.x, d.y]] };
  };

  it('has sane dimensions and in-bounds anchors', () => {
    expect(TOWN_W).toBeGreaterThanOrEqual(20);
    expect(TOWN_H).toBeGreaterThanOrEqual(20);
    for (const p of [TOWN_SPAWN, TOWN_GATE, TOWN_PORTAL]) {
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(TOWN_W - 1);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(TOWN_H - 1);
    }
  });

  it('sits the Town Portal mid-clearing on the main avenue, not at the bottom edge', () => {
    // Portaling in drops the hero out of the return portal ONTO this tile, so it must
    // be a walkable avenue tile up in the clearing — never tucked against the bottom
    // wall by the entrance.
    const onAvenue = TOWN_PATHS.some((p) => p.x === TOWN_PORTAL.x && p.y === TOWN_PORTAL.y);
    expect(onAvenue).toBe(true);
    expect(TOWN_PORTAL.y).toBeLessThan(TOWN_SPAWN.y - 2);   // clearly above the bottom entrance
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
      'covenants', 'weave', 'pantheon', 'healer', 'trainer', 'bounty', 'deeds',
      'cycles', 'stash', 'prospector',
    ];
    expect(kinds.slice().sort()).toEqual(expected.slice().sort());
  });

  it('has no Mystic keeper (the Wandering Mystic lives in the dungeon, not town)', () => {
    expect(TOWN_NPCS.some((n) => n.kind === 'mystic')).toBe(false);
  });

  it('gathers every endgame keeper INSIDE the hedged sanctum, and no regular one', () => {
    // The endgame keepers cluster in the walled grove's interior (one tile in from the
    // TOWN_SANCTUM box, which is the hedge ring itself); every regular keeper sits out
    // in the open clearing. This is the "group all end-game NPCs together in a separate
    // room" invariant.
    const ENDGAME = new Set(['covenants', 'weave', 'pantheon', 'mirrorforge', 'deeds', 'cycles']);
    const b = TOWN_SANCTUM;
    const inInterior = (n) => n.x > b.x0 && n.x < b.x1 && n.y > b.y0 && n.y < b.y1;
    for (const n of TOWN_NPCS) {
      if (ENDGAME.has(n.kind)) expect(inInterior(n)).toBe(true);
      else expect(inInterior(n)).toBe(false);
    }
    // The sanctum is a real enclosure: a ring of solid hedge ('h') decor around that
    // interior, with exactly ONE walkable gap (its doorway) on the border.
    const hedges = new Set(TOWN_DECOR.filter((d) => d.c === 'h').map((d) => key(d.x, d.y)));
    let gaps = 0;
    for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y <= b.y1; y++) {
      const border = x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1;
      if (border && !hedges.has(key(x, y))) gaps++;
    }
    expect(gaps).toBe(1);
  });

  it('leaves no walkable strip above or west of the grove (nothing for a keeper to get stranded in)', () => {
    // The grove is tucked into the top-left corner, so its top and west walls butt
    // straight against the solid treeline — if an open lane sat between them, a
    // wandering keeper could slip in and pace a dead single-tile strip. Build the
    // solid-blocked set (borders + solid decor footprints) and assert every tile
    // directly outside those two walls, across the grove's span, is blocked.
    const hedges = TOWN_DECOR.filter((d) => d.c === 'h');
    const topWallY = Math.min(...hedges.map((d) => d.y));
    const westWallX = Math.min(...hedges.map((d) => d.x));
    const xs = hedges.map((d) => d.x);
    const ys = hedges.map((d) => d.y);
    const blocked = new Set();
    for (let x = 0; x < TOWN_W; x++) for (let y = 0; y < TOWN_H; y++) if (isBorder(x, y)) blocked.add(key(x, y));
    for (const d of TOWN_DECOR) { const r = resolve(d); if (r.solid) for (const [fx, fy] of r.foot) blocked.add(key(fx, fy)); }
    for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
      expect(blocked.has(key(x, topWallY - 1))).toBe(true);
    }
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      expect(blocked.has(key(westWallX - 1, y))).toBe(true);
    }
  });

  it('TOWN_SANCTUM bounds enclose the whole grove — every hedge tile and endgame keeper, no regular one', () => {
    // The wander guard keys off TOWN_SANCTUM (buildTown blocks it from the free-set,
    // updateTownNpcs re-checks it), so the box must cover the entire endgame room. If
    // it ever fell short of the hedge or a keeper, a strolling townsperson could slip
    // into the endgame grove — this pins the bounds to the authored layout.
    const inBox = (x, y) => inSanctum(x, y, TOWN_SANCTUM);
    for (const d of TOWN_DECOR.filter((dd) => dd.c === 'h')) expect(inBox(d.x, d.y)).toBe(true);
    const endgame = new Set(TOWN_ENDGAME_KINDS);
    for (const n of TOWN_NPCS) expect(inBox(n.x, n.y)).toBe(endgame.has(n.kind));
  });

  it('pins the Craftsman just off the avenue beside the Town Portal (never wanders, never blocks the path)', () => {
    // The Craftsman is the keeper the hero returns to constantly, so it must be easy to
    // find: pinned (TOWN_FIXED_KINDS) close to the Town Portal and above it. But it sits
    // BESIDE the avenue, not on it — its own tile is off every path so it never blocks
    // the walkway, yet a path tile is orthogonally adjacent so it's greeted in one step.
    const forge = TOWN_NPCS.find((n) => n.kind === 'forge');
    expect(forge).toBeTruthy();
    expect(TOWN_FIXED_KINDS).toContain('forge');
    expect(forge.y).toBeLessThan(TOWN_PORTAL.y); // north of (above) the portal
    const cheb = Math.max(Math.abs(forge.x - TOWN_PORTAL.x), Math.abs(forge.y - TOWN_PORTAL.y));
    expect(cheb).toBeLessThanOrEqual(3);         // close enough to greet the moment you portal in
    const onPath = TOWN_PATHS.some((p) => p.x === forge.x && p.y === forge.y);
    expect(onPath).toBe(false);                  // sits beside the path, not on it
    const pathAdjacent = TOWN_PATHS.some((p) => Math.abs(p.x - forge.x) + Math.abs(p.y - forge.y) === 1);
    expect(pathAdjacent).toBe(true);             // but a path tile is one step away
  });

  it('makes the Merchant and Craftsman the two founding keepers (both share arrival 1)', () => {
    // The town-unlock (felling the Floor 5 guardian) brings BOTH founders at once, so a
    // hero's very first town visit has the Merchant AND the Craftsman — somewhere to spend
    // the first haul, plus the Craftsman's HUD Field Kit on hand from the start (and it's
    // the keeper waiting right by the portal). The Healer follows on boss #3.
    expect(TOWN_SERVICE_ARRIVALS.merchant).toBe(1);
    expect(TOWN_SERVICE_ARRIVALS.forge).toBe(1);
    expect(TOWN_SERVICE_ARRIVALS.healer).toBe(3);
    // Exactly those two share arrival 1; every other keeper joins on a later boss (>1),
    // so no keeper is left un-numbered or ahead of the founders.
    for (const n of TOWN_NPCS) {
      const arrival = TOWN_SERVICE_ARRIVALS[n.kind];
      expect(typeof arrival).toBe('number');
      if (n.kind === 'merchant' || n.kind === 'forge') expect(arrival).toBe(1);
      else expect(arrival).toBeGreaterThan(1);
    }
  });

  it('lands the Trainer ahead of the Ramen House (respec/ascension before cooking)', () => {
    // The Trainer holds respec, class change and ascension, so it joins on boss #5 —
    // around the level the ascension gate opens — and the Ramen House takes the later
    // #7 slot it vacated. The Prospector keeps #6 between them.
    expect(TOWN_SERVICE_ARRIVALS.trainer).toBe(5);
    expect(TOWN_SERVICE_ARRIVALS.prospector).toBe(6);
    expect(TOWN_SERVICE_ARRIVALS.ramen).toBe(7);
    expect(TOWN_SERVICE_ARRIVALS.trainer).toBeLessThan(TOWN_SERVICE_ARRIVALS.ramen);
  });

  it('gives every keeper its own arrival slot except the two founders', () => {
    // One keeper joins per boss kill, so no two arrival numbers may collide (the
    // Merchant + Craftsman pair on #1 is the single deliberate exception) — a swap
    // that duplicated a number would silently land two keepers on one boss.
    const counts = new Map();
    for (const arrival of Object.values(TOWN_SERVICE_ARRIVALS)) counts.set(arrival, (counts.get(arrival) || 0) + 1);
    for (const [arrival, n] of counts) expect(n).toBe(arrival === 1 ? 2 : 1);
  });

  it('keeps every fixed keeper a regular open-clearing keeper (not a sanctum one)', () => {
    // Fixed keepers pin an OPEN-clearing keeper in place; they are never the hedged
    // endgame keepers (those already own their sanctum tiles), so none sits inside
    // the sanctum box and none doubles as an endgame kind.
    for (const kind of TOWN_FIXED_KINDS) {
      expect(TOWN_ENDGAME_KINDS).not.toContain(kind);
      const n = TOWN_NPCS.find((k) => k.kind === kind);
      expect(n).toBeTruthy();
      expect(inSanctum(n.x, n.y, TOWN_SANCTUM)).toBe(false);
    }
  });

  it('every decor entry resolves to a real atlas piece and is in bounds', () => {
    for (const d of TOWN_DECOR) {
      const { id } = resolve(d);
      expect(DECOR_INDEX[id]).toBeDefined();
      expect(isBorder(d.x, d.y)).toBe(false);
      if (d.c != null) expect(TOWN_DECOR_FAMILIES[d.c]).toBeDefined();
    }
  });

  it('no decor footprint covers a keeper, the spawn, or an exit', () => {
    const reserved = new Set([
      ...TOWN_NPCS.map((n) => key(n.x, n.y)),
      key(TOWN_SPAWN.x, TOWN_SPAWN.y), key(TOWN_GATE.x, TOWN_GATE.y), key(TOWN_PORTAL.x, TOWN_PORTAL.y),
    ]);
    for (const d of TOWN_DECOR) {
      for (const [fx, fy] of resolve(d).foot) expect(reserved.has(key(fx, fy))).toBe(false);
    }
  });

  it('keeps every keeper, the gate and the portal reachable from the spawn', () => {
    const blocked = new Set();
    for (let x = 0; x < TOWN_W; x++) for (let y = 0; y < TOWN_H; y++) if (isBorder(x, y)) blocked.add(key(x, y));
    for (const d of TOWN_DECOR) { const r = resolve(d); if (r.solid) for (const [fx, fy] of r.foot) blocked.add(key(fx, fy)); }
    for (const n of TOWN_NPCS) blocked.add(key(n.x, n.y));

    const reach = reachableTiles(blocked, TOWN_W, TOWN_H, TOWN_SPAWN);
    const objs = townObjects(TOWN_NPCS, TOWN_GATE, TOWN_PORTAL, true);
    for (const o of objs) expect(isApproachable(o, reach)).toBe(true);
  });

  it('paths are in-bounds interior tiles', () => {
    for (const p of TOWN_PATHS) {
      expect(isBorder(p.x, p.y)).toBe(false);
    }
  });

  it('keeps every keeper clear of tree canopies (never hidden behind a tree)', () => {
    // Tree families (block "base") occlude actors standing behind them; a keeper you
    // must interact with should never sit under a canopy. Bushes block but don't
    // occlude (fully solid), so they don't count.
    const treeChars = new Set(['T', 'a', 't']);
    const canopy = new Set();
    for (const d of TOWN_DECOR) {
      if (d.c == null || !treeChars.has(d.c)) continue;
      const id = pickDecorVariant(TOWN_DECOR_FAMILIES[d.c].ids, d.x, d.y);
      const dd = DECOR_INDEX[id];
      const Ht = Math.max(1, Math.round(dd.ht)), HW = Math.floor(Math.round(dd.w / 32) / 2);
      for (let yy = d.y - Ht + 1; yy < d.y; yy++) for (let xx = d.x - HW; xx <= d.x + HW; xx++) canopy.add(key(xx, yy));
    }
    for (const n of TOWN_NPCS) expect(canopy.has(key(n.x, n.y))).toBe(false);
  });
});
