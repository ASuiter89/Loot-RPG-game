import { describe, it, expect } from 'vitest';
import { pointPoolList, pointPoolPhrase, hasUnspentPoints, POINT_POOLS, POINT_TABS } from '../../src/systems/pointPools.js';

// What one ordinary level pays: 5 hero points, 1 skill point, no ascendancy.
const LEVEL = { attr: 5, skill: 1, asc: 0 };

describe('pointPoolList', () => {
  it('names every pool that actually paid out', () => {
    expect(pointPoolList(LEVEL)).toEqual(['5 hero points', '1 skill point']);
  });

  // The bug this module exists for: the shore's graduation announced a skill point and
  // never once named the FIVE hero points beside it, so players came away certain the
  // hero points had never been granted. Both pools, every time, with their counts.
  it('never drops the hero pool from a level-up', () => {
    expect(pointPoolList(LEVEL)[0]).toBe('5 hero points');
  });

  it('pluralises off the count', () => {
    expect(pointPoolList({ attr: 1, skill: 2 })).toEqual(['1 hero point', '2 skill points']);
  });

  it('leaves out an empty pool rather than saying "0 ascendancy points"', () => {
    expect(pointPoolList({ attr: 5, skill: 1, asc: 0 })).not.toContain('0 ascendancy points');
    expect(pointPoolList({ skill: 1 })).toEqual(['1 skill point']);
  });

  it('lists hero → skill → ascendancy regardless of key order', () => {
    expect(pointPoolList({ asc: 1, skill: 1, attr: 5 }))
      .toEqual(['5 hero points', '1 skill point', '1 ascendancy point']);
  });

  it('reads a garbage or missing bag as nothing owed', () => {
    expect(pointPoolList(null)).toEqual([]);
    expect(pointPoolList({})).toEqual([]);
    expect(pointPoolList({ attr: NaN, skill: undefined, asc: -3 })).toEqual([]);
  });

  it('floors a fractional count instead of printing it', () => {
    expect(pointPoolList({ attr: 5.7 })).toEqual(['5 hero points']);
  });
});

describe('pointPoolPhrase', () => {
  it('joins a level-up into one readable phrase', () => {
    expect(pointPoolPhrase(LEVEL)).toBe('5 hero points and 1 skill point');
  });

  it('needs no joiner for a lone pool', () => {
    expect(pointPoolPhrase({ skill: 1 })).toBe('1 skill point');
  });

  it('commas the front of a three-pool level', () => {
    expect(pointPoolPhrase({ attr: 5, skill: 1, asc: 1 }))
      .toBe('5 hero points, 1 skill point and 1 ascendancy point');
  });

  it('takes a terse separator for HUD lines', () => {
    expect(pointPoolPhrase(LEVEL, '·')).toBe('5 hero points · 1 skill point');
  });

  it('is empty when nothing is owed, so a caller can skip the message', () => {
    expect(pointPoolPhrase({})).toBe('');
    expect(pointPoolPhrase(null)).toBe('');
  });
});

describe('hasUnspentPoints', () => {
  it('is true while any pool holds a point', () => {
    expect(hasUnspentPoints({ attr: 5 })).toBe(true);
    expect(hasUnspentPoints({ asc: 1 })).toBe(true);
  });

  // The beach cave gates on exactly this — it won't take a hero with points unspent.
  it('is false once every pool is spent', () => {
    expect(hasUnspentPoints({ attr: 0, skill: 0, asc: 0 })).toBe(false);
    expect(hasUnspentPoints(null)).toBe(false);
  });
});

describe('the pool table', () => {
  it('names the attribute pool "hero point" — the tab it is spent on', () => {
    expect(POINT_POOLS[0]).toEqual(['attr', 'hero point']);
    expect(POINT_TABS.attr).toBe('HERO');
  });

  it('gives every pool a tab to spend it on', () => {
    for (const [key] of POINT_POOLS) expect(POINT_TABS[key]).toBeTruthy();
  });
});
