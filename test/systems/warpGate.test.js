import { describe, it, expect } from 'vitest';
import { WARP_STEP, isWarpCheckpoint, warpFloorFor, warpCheckpoints } from '../../src/systems/warpGate.js';

describe('WARP_STEP', () => {
  it('gates warping to every fifth floor', () => {
    expect(WARP_STEP).toBe(5);
  });
});

describe('isWarpCheckpoint', () => {
  it('is true on 1, 6, 11, 16, 21 … and false in between', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 11, 16, 21, 26].map(isWarpCheckpoint))
      .toEqual([true, false, false, false, false, true, false, true, true, true, true]);
  });

  it('floors a fractional floor before testing', () => {
    expect(isWarpCheckpoint(6.9)).toBe(true);
    expect(isWarpCheckpoint(7.1)).toBe(false);
  });

  it('treats sub-1 floors as non-checkpoints', () => {
    expect(isWarpCheckpoint(0)).toBe(false);
    expect(isWarpCheckpoint(-4)).toBe(false);
  });
});

describe('warpFloorFor', () => {
  it('snaps a floor down to the checkpoint at or below it', () => {
    expect(warpFloorFor(1)).toBe(1);
    expect(warpFloorFor(5)).toBe(1);
    expect(warpFloorFor(6)).toBe(6);
    expect(warpFloorFor(24)).toBe(21);
    expect(warpFloorFor(21)).toBe(21);
    expect(warpFloorFor(25)).toBe(21);
  });

  it('is valid on a CONTINUOUS depth too — checkpoints align to tier floor 1', () => {
    // Hardened floor 2 is continuous depth 27; its checkpoint is Hardened floor 1
    // (continuous 26) — snapping never crosses down into Normal.
    expect(warpFloorFor(27)).toBe(26);
    expect(warpFloorFor(26)).toBe(26);
    // Endless floor 15 is continuous depth 90; its checkpoint is Endless floor 11
    // (continuous 86).
    expect(warpFloorFor(90)).toBe(86);
  });

  it('never returns below 1 for garbage input', () => {
    expect(warpFloorFor(0)).toBe(1);
    expect(warpFloorFor(-9)).toBe(1);
    expect(warpFloorFor(NaN)).toBe(1);
    expect(warpFloorFor(undefined)).toBe(1);
  });
});

describe('warpCheckpoints', () => {
  it('lists every checkpoint up to a finite tier\'s reach', () => {
    // A hero who reached Normal floor 24 can warp to 1, 6, 11, 16, 21 (not 26).
    expect(warpCheckpoints(24)).toEqual([1, 6, 11, 16, 21]);
    // Conquered/full tier tops out at floor 21 too — 25 is not a checkpoint.
    expect(warpCheckpoints(25)).toEqual([1, 6, 11, 16, 21]);
  });

  it('always offers floor 1 when that is as deep as you have reached', () => {
    expect(warpCheckpoints(1)).toEqual([1]);
    expect(warpCheckpoints(5)).toEqual([1]);
  });

  it('windows to a recent stretch when `from` is given (deep Endless)', () => {
    // Deep Endless lists only the most recent checkpoints, not thousands.
    expect(warpCheckpoints(63, 24)).toEqual([26, 31, 36, 41, 46, 51, 56, 61]);
  });

  it('floors fractional / clamps garbage inputs', () => {
    expect(warpCheckpoints(11.9)).toEqual([1, 6, 11]);
    expect(warpCheckpoints(0)).toEqual([1]);
    expect(warpCheckpoints(NaN)).toEqual([1]);
    expect(warpCheckpoints(11, 0)).toEqual([1, 6, 11]);
  });
});
