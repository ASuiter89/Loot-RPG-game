import { describe, it, expect } from 'vitest';
import { floorUnlockedByClear, foldReached, clearedFrontier } from '../../src/systems/depth.js';

// Production tuning: a tier is 25 floors; finite depth ends at floor 75.
const FLOORS_PER_DIFF = 25;
const FINITE_DEPTH = 75;
const frontier = (cf) => clearedFrontier(cf, FLOORS_PER_DIFF, FINITE_DEPTH);

describe('floorUnlockedByClear', () => {
  it('opens the next floor when a floor with stairs down is cleared', () => {
    expect(floorUnlockedByClear(1, false)).toBe(2);
    expect(floorUnlockedByClear(4, false)).toBe(5);
    expect(floorUnlockedByClear(24, false)).toBe(25);
  });

  it('opens no ordinary stairs on a tier\'s last finite floor', () => {
    // Floor 25/50/75 has no down-stairs — conquering it unlocks the next
    // difficulty instead, so a clear there bumps no deepest-floor.
    expect(floorUnlockedByClear(25, true)).toBeNull();
    expect(floorUnlockedByClear(75, true)).toBeNull();
  });

  it('keeps climbing in the endless frontier (no last-finite floor there)', () => {
    expect(floorUnlockedByClear(76, false)).toBe(77);
    expect(floorUnlockedByClear(130, false)).toBe(131);
  });

  it('floors a fractional depth before advancing', () => {
    expect(floorUnlockedByClear(4.9, false)).toBe(5);
  });

  it('treats garbage / sub-1 depth as floor 1', () => {
    expect(floorUnlockedByClear(0, false)).toBe(2);
    expect(floorUnlockedByClear(-5, false)).toBe(2);
    expect(floorUnlockedByClear(NaN, false)).toBe(2);
    expect(floorUnlockedByClear(undefined, false)).toBe(2);
  });
});

describe('foldReached', () => {
  it('climbs both trackers when reaching a deeper floor', () => {
    expect(foldReached(4, 4, 5)).toEqual({ maxFloor: 5, gateFloor: 5, advanced: true });
  });

  it('never descends — a shallower floor leaves both trackers untouched', () => {
    expect(foldReached(10, 10, 3)).toEqual({ maxFloor: 10, gateFloor: 10, advanced: false });
  });

  it('flags advanced only on a fresh all-time record, not a tie', () => {
    expect(foldReached(5, 5, 5).advanced).toBe(false);
    expect(foldReached(5, 5, 6).advanced).toBe(true);
  });

  it('lifts a death-relocked gateFloor without touching maxFloor when re-treading', () => {
    // A death shoved gateFloor back to 3 while maxFloor stayed 10. Fighting back to
    // floor 5 re-opens it up to 5, but sets no new record.
    expect(foldReached(10, 3, 5)).toEqual({ maxFloor: 10, gateFloor: 5, advanced: false });
  });

  it('advances both again once you push past the old record', () => {
    expect(foldReached(10, 3, 12)).toEqual({ maxFloor: 12, gateFloor: 12, advanced: true });
  });

  it('floors a fractional depth before folding', () => {
    expect(foldReached(4, 4, 5.9)).toEqual({ maxFloor: 5, gateFloor: 5, advanced: true });
  });

  it('treats null/undefined trackers as floor 1', () => {
    expect(foldReached(null, null, 1)).toEqual({ maxFloor: 1, gateFloor: 1, advanced: false });
    expect(foldReached(undefined, undefined, 5)).toEqual({ maxFloor: 5, gateFloor: 5, advanced: true });
  });

  it('clamps a sub-1 reached floor up to 1', () => {
    expect(foldReached(1, 1, 0)).toEqual({ maxFloor: 1, gateFloor: 1, advanced: false });
    expect(foldReached(1, 1, NaN)).toEqual({ maxFloor: 1, gateFloor: 1, advanced: false });
  });
});

describe('clearedFrontier', () => {
  it('returns 0 for an empty / absent / non-object set', () => {
    expect(frontier({})).toBe(0);
    expect(frontier(null)).toBe(0);
    expect(frontier(undefined)).toBe(0);
    expect(frontier('nope')).toBe(0);
  });

  it('opens the floor after the deepest cleared floor', () => {
    // Cleared through the floor-5 boss ⇒ floor 6 (the next warp checkpoint) is earned.
    expect(frontier({ 1: true, 2: true, 3: true, 4: true, 5: true })).toBe(6);
    expect(frontier({ 10: true })).toBe(11);
  });

  it('ignores falsy / stale entries and keys off the deepest truthy one', () => {
    expect(frontier({ 3: true, 7: false, 5: true, 9: 0 })).toBe(6);
  });

  it('never bumps past a tier\'s last finite floor (that unlocks the next DIFFICULTY, not floor N+1)', () => {
    // Clearing floor 25/50/75 conquers a tier; it must not push the continuous
    // frontier into the next tier (that gate is diffCleared, tracked separately).
    expect(frontier({ 25: true })).toBe(25);
    expect(frontier({ 24: true, 25: true })).toBe(25);
    expect(frontier({ 50: true })).toBe(50);
    expect(frontier({ 75: true })).toBe(75);
  });

  it('keeps climbing in the endless frontier (no last-finite floor past 75)', () => {
    expect(frontier({ 76: true })).toBe(77);
    expect(frontier({ 120: true })).toBe(121);
  });

  it('floors fractional / garbage keys and skips sub-1 ones', () => {
    expect(frontier({ '4.9': true })).toBe(5);
    expect(frontier({ 0: true, '-3': true })).toBe(0);
  });
});
