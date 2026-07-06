import { describe, it, expect } from 'vitest';
import { bountyProgress, bountyDone, bountyNewlyComplete } from '../../src/systems/bounty.js';

// A hero-totals snapshot with sensible zeros, overridable per case.
const totals = (o = {}) => ({
  kills: 0, maxFloor: 1, clearedFloors: 0, bossKills: 0, eliteKills: 0, goldEarned: 0, ...o,
});

describe('bountyProgress', () => {
  it('is 0 for no bounty', () => {
    expect(bountyProgress(null, totals())).toBe(0);
    expect(bountyProgress(undefined, totals())).toBe(0);
  });

  it('measures the delta since the accept-time snapshot for a slay contract', () => {
    const b = { kind: 'slay', need: 10, snap: 40 };
    expect(bountyProgress(b, totals({ kills: 40 }))).toBe(0);
    expect(bountyProgress(b, totals({ kills: 47 }))).toBe(7);
  });

  it('never reports negative progress if a counter is below the snapshot', () => {
    const b = { kind: 'slay', need: 10, snap: 40 };
    expect(bountyProgress(b, totals({ kills: 12 }))).toBe(0);
  });

  it('tracks absolute depth (ignoring snap) for a delve contract', () => {
    const b = { kind: 'delve', need: 8, snap: 0 };
    expect(bountyProgress(b, totals({ maxFloor: 5 }))).toBe(5);
    // A missing maxFloor floors at 1 (the hero is always at least on floor 1).
    expect(bountyProgress(b, totals({ maxFloor: 0 }))).toBe(1);
  });

  it('handles clear / boss / elite / gold kinds off their own counters', () => {
    expect(bountyProgress({ kind: 'clear', need: 3, snap: 2 }, totals({ clearedFloors: 5 }))).toBe(3);
    expect(bountyProgress({ kind: 'boss', need: 2, snap: 1 }, totals({ bossKills: 3 }))).toBe(2);
    expect(bountyProgress({ kind: 'elite', need: 5, snap: 4 }, totals({ eliteKills: 9 }))).toBe(5);
    expect(bountyProgress({ kind: 'gold', need: 500, snap: 100 }, totals({ goldEarned: 700 }))).toBe(600);
  });

  it('treats a missing snapshot as 0', () => {
    expect(bountyProgress({ kind: 'slay', need: 5 }, totals({ kills: 6 }))).toBe(6);
  });

  it('falls back to 0 when a kind\'s counter is missing/falsy', () => {
    // Exercises the `|| 0` fallback on every counter, not just the truthy path.
    expect(bountyProgress({ kind: 'slay', need: 1, snap: 0 }, {})).toBe(0);
    expect(bountyProgress({ kind: 'clear', need: 1, snap: 0 }, {})).toBe(0);
    expect(bountyProgress({ kind: 'boss', need: 1, snap: 0 }, {})).toBe(0);
    expect(bountyProgress({ kind: 'elite', need: 1, snap: 0 }, {})).toBe(0);
    expect(bountyProgress({ kind: 'gold', need: 1, snap: 0 }, {})).toBe(0);
  });

  it('is 0 for an unknown kind', () => {
    expect(bountyProgress({ kind: 'mystery', need: 5, snap: 0 }, totals({ kills: 99 }))).toBe(0);
  });

  it('tolerates a missing totals snapshot', () => {
    expect(bountyProgress({ kind: 'slay', need: 5, snap: 0 })).toBe(0);
    expect(bountyProgress({ kind: 'delve', need: 5, snap: 0 })).toBe(1);
  });
});

describe('bountyDone', () => {
  it('is false with no bounty', () => {
    expect(bountyDone(null, totals())).toBe(false);
  });

  it('flips true only once progress reaches the goal', () => {
    const b = { kind: 'boss', need: 2, snap: 0 };
    expect(bountyDone(b, totals({ bossKills: 1 }))).toBe(false);
    expect(bountyDone(b, totals({ bossKills: 2 }))).toBe(true);
    expect(bountyDone(b, totals({ bossKills: 5 }))).toBe(true); // overshoot still done
  });
});

describe('bountyNewlyComplete', () => {
  it('is false with no bounty', () => {
    expect(bountyNewlyComplete(null, totals())).toBe(false);
  });

  it('fires exactly once on the not-done → done edge, then latches quiet', () => {
    const b = { kind: 'slay', need: 3, snap: 0 };
    expect(bountyNewlyComplete(b, totals({ kills: 1 }))).toBe(false); // still in progress
    expect(bountyNewlyComplete(b, totals({ kills: 3 }))).toBe(true);  // just crossed the goal
    expect(b.doneNotified).toBe(true);
    expect(bountyNewlyComplete(b, totals({ kills: 4 }))).toBe(false); // already announced
    expect(bountyNewlyComplete(b, totals({ kills: 9 }))).toBe(false);
  });

  it('re-arms and fires again if progress falls back below the goal', () => {
    const b = { kind: 'boss', need: 2, snap: 0 };
    expect(bountyNewlyComplete(b, totals({ bossKills: 2 }))).toBe(true);
    expect(b.doneNotified).toBe(true);
    // A counter reset drops progress below the goal — the latch re-arms.
    expect(bountyNewlyComplete(b, totals({ bossKills: 0 }))).toBe(false);
    expect(b.doneNotified).toBe(false);
    expect(bountyNewlyComplete(b, totals({ bossKills: 2 }))).toBe(true);
  });

  it('does not re-fire for a bounty already flagged done (e.g. loaded mid-complete)', () => {
    const b = { kind: 'slay', need: 1, snap: 0, doneNotified: true };
    expect(bountyNewlyComplete(b, totals({ kills: 5 }))).toBe(false);
  });
});
