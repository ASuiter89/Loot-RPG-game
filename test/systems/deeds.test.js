import { describe, it, expect } from 'vitest';
import {
  snapshotValue,
  deedSatisfied,
  deedProgress,
  evaluateDeeds,
  deedsByCategory,
} from '../../src/systems/deeds.js';
import { DEEDS } from '../../src/data/deeds.js';

// A fully-populated snapshot with a distinct number on every axis, so a reader that
// grabs the wrong branch is caught.
const FULL = {
  collection: { have: 42, total: 200 },
  bestiary: { discovered: 33, total: 90 },
  diffCleared: 2,
  maxFloor: 57,
  endlessFloor: 18,
  bounties: { total: 26, perClass: { warrior: 10, mage: 16 } },
  classesPlayed: ['warrior', 'mage', 'rogue'],
  setsCompleted: 4,
  mirrored: 7,
};

// A tiny custom catalog exercising the generic path without leaning on live tuning.
const T = [
  { id: 'a', category: 'depth',      name: 'A', desc: 'a', sprite: 's', renown: 10,  requirement: { kind: 'maxFloor', threshold: 5 } },
  { id: 'b', category: 'depth',      name: 'B', desc: 'b', sprite: 's', renown: 20,  requirement: { kind: 'maxFloor', threshold: 60 } },
  { id: 'c', category: 'collection', name: 'C', desc: 'c', sprite: 's', renown: 100, requirement: { kind: 'collectionHave', threshold: 10 } },
];

describe('snapshotValue — every requirement kind reads the right axis', () => {
  const cases = [
    ['collectionHave', 42],
    ['bestiaryDiscovered', 33],
    ['diffCleared', 2],
    ['maxFloor', 57],
    ['endlessFloor', 18],
    ['bountyTotal', 26],
    ['classesPlayed', 3], // COUNT of the array, not the array
    ['setsCompleted', 4],
    ['mirrored', 7],
  ];
  for (const [kind, expected] of cases) {
    it(`${kind} → ${expected}`, () => {
      expect(snapshotValue(FULL, kind)).toBe(expected);
    });
  }

  it('returns 0 for an unknown kind', () => {
    expect(snapshotValue(FULL, 'nope')).toBe(0);
    expect(snapshotValue(FULL, undefined)).toBe(0);
  });

  it('coerces garbage / missing snapshot branches to 0 (never throws)', () => {
    expect(snapshotValue(null, 'maxFloor')).toBe(0);
    expect(snapshotValue(undefined, 'collectionHave')).toBe(0);
    expect(snapshotValue({}, 'collectionHave')).toBe(0);
    expect(snapshotValue({ collection: {} }, 'collectionHave')).toBe(0);
    expect(snapshotValue({ maxFloor: NaN }, 'maxFloor')).toBe(0);
    expect(snapshotValue({ maxFloor: -5 }, 'maxFloor')).toBe(0);
    expect(snapshotValue({ bounties: null }, 'bountyTotal')).toBe(0);
    expect(snapshotValue({ classesPlayed: 'warrior' }, 'classesPlayed')).toBe(0); // not an array
    expect(snapshotValue({ classesPlayed: [] }, 'classesPlayed')).toBe(0);
  });
});

describe('deedSatisfied', () => {
  it('is true once the axis value meets the threshold (>= boundary)', () => {
    expect(deedSatisfied(T[0], FULL)).toBe(true);        // maxFloor 57 >= 5
    expect(deedSatisfied({ ...T[0], requirement: { kind: 'maxFloor', threshold: 57 } }, FULL)).toBe(true); // exact
  });

  it('is false when below threshold', () => {
    expect(deedSatisfied(T[1], FULL)).toBe(false);       // maxFloor 57 < 60
  });

  it('is false for a missing / broken requirement', () => {
    expect(deedSatisfied(null, FULL)).toBe(false);
    expect(deedSatisfied({}, FULL)).toBe(false);
    expect(deedSatisfied({ requirement: {} }, FULL)).toBe(false);
    expect(deedSatisfied({ requirement: { kind: 'maxFloor', threshold: 0 } }, FULL)).toBe(false);
    expect(deedSatisfied({ requirement: { kind: 'maxFloor', threshold: -3 } }, FULL)).toBe(false);
  });

  it('floors a fractional threshold', () => {
    // 57 >= floor(57.9)=57 → true ; 57 >= floor(58.1)=58 → false
    expect(deedSatisfied({ requirement: { kind: 'maxFloor', threshold: 57.9 } }, FULL)).toBe(true);
    expect(deedSatisfied({ requirement: { kind: 'maxFloor', threshold: 58.1 } }, FULL)).toBe(false);
  });
});

describe('deedProgress', () => {
  it('reports have/need/pct with have capped at need', () => {
    const p = deedProgress(T[2], FULL); // collectionHave 42 vs need 10
    expect(p.need).toBe(10);
    expect(p.have).toBe(10);            // capped, not 42
    expect(p.pct).toBe(1);
  });

  it('is a partial fraction mid-way', () => {
    const p = deedProgress(T[1], FULL); // maxFloor 57 vs need 60
    expect(p.have).toBe(57);
    expect(p.need).toBe(60);
    expect(p.pct).toBeCloseTo(57 / 60, 10);
  });

  it('degrades safely for a garbage deed', () => {
    const p = deedProgress({ requirement: { kind: 'maxFloor', threshold: 0 } }, FULL);
    expect(p).toEqual({ have: 0, need: 0, pct: 1 }); // value>0 with a zero bar reads as done
    const p2 = deedProgress({ requirement: { kind: 'nope', threshold: 5 } }, FULL);
    expect(p2).toEqual({ have: 0, need: 5, pct: 0 });
    const p3 = deedProgress(null, FULL);
    expect(p3).toEqual({ have: 0, need: 0, pct: 0 });
  });
});

describe('evaluateDeeds', () => {
  it('collects satisfied ids and sums their renown', () => {
    const r = evaluateDeeds(FULL, [], T);
    expect(r.completedIds).toEqual(['a', 'c']); // b (need 60) not met
    expect(r.totalRenown).toBe(110);            // 10 + 100
  });

  it('newlyCompleted only lists ids NOT already in the prev set', () => {
    const r = evaluateDeeds(FULL, ['a'], T);
    expect(r.completedIds).toEqual(['a', 'c']);
    expect(r.newlyCompleted).toEqual(['c']);    // a was already known
  });

  it('accepts a Set for prevCompletedIds', () => {
    const r = evaluateDeeds(FULL, new Set(['a', 'c']), T);
    expect(r.newlyCompleted).toEqual([]);       // nothing new
  });

  it('treats a missing prev list as a fresh account (all new)', () => {
    const r = evaluateDeeds(FULL, undefined, T);
    expect(r.newlyCompleted).toEqual(['a', 'c']);
  });

  it('ignores garbage renown values in the sum', () => {
    const bad = [{ id: 'x', requirement: { kind: 'maxFloor', threshold: 1 }, renown: 'lots' }];
    const r = evaluateDeeds(FULL, [], bad);
    expect(r.completedIds).toEqual(['x']);
    expect(r.totalRenown).toBe(0);
  });

  it('returns an empty result for garbage data or an empty snapshot', () => {
    expect(evaluateDeeds(FULL, [], null)).toEqual({ completedIds: [], totalRenown: 0, newlyCompleted: [] });
    const empty = evaluateDeeds({}, [], T);
    expect(empty.completedIds).toEqual([]);
    expect(empty.totalRenown).toBe(0);
  });

  it('skips null entries in the catalog', () => {
    const r = evaluateDeeds(FULL, [], [null, T[0]]);
    expect(r.completedIds).toEqual(['a']);
  });

  it('runs against the LIVE DEEDS catalog and stays consistent', () => {
    const r = evaluateDeeds(FULL, [], DEEDS);
    // Every reported id is genuinely satisfied and renown sums to the members.
    const byId = new Map(DEEDS.map((d) => [d.id, d]));
    let sum = 0;
    for (const id of r.completedIds) {
      expect(deedSatisfied(byId.get(id), FULL)).toBe(true);
      sum += byId.get(id).renown;
    }
    expect(r.totalRenown).toBe(sum);
    // On this snapshot the front-loaded early deeds are all done.
    expect(r.completedIds).toContain('dep_2');
    expect(r.completedIds).toContain('bnt_1');
    // And a deep capstone is NOT.
    expect(r.completedIds).not.toContain('end_100');
  });
});

describe('deedsByCategory', () => {
  it('groups in first-seen category order, defaulting to live DEEDS', () => {
    const groups = deedsByCategory();
    expect(groups[0].category).toBe('collection'); // first category in the data
    // Every deed lands in exactly one group and none are dropped.
    const flat = groups.flatMap((g) => g.deeds);
    expect(flat.length).toBe(DEEDS.length);
  });

  it('honours a custom catalog and preserves order', () => {
    const groups = deedsByCategory(T);
    expect(groups.map((g) => g.category)).toEqual(['depth', 'collection']);
    expect(groups[0].deeds.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('buckets a category-less deed under "other" and tolerates junk', () => {
    const groups = deedsByCategory([null, { id: 'z', requirement: {} }]);
    expect(groups).toEqual([{ category: 'other', deeds: [{ id: 'z', requirement: {} }] }]);
    expect(deedsByCategory(null)).toEqual([]);
  });
});
