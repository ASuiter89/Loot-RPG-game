import { describe, it, expect } from 'vitest';
import { renownRank, unlockedRewards, nextReward } from '../../src/systems/renown.js';
import { RENOWN_TRACK } from '../../src/data/renownTrack.js';

// A compact custom track: three ranks, easy to reason about boundaries on.
const TRK = {
  ranks: [
    { rank: 1, renownNeeded: 0,   reward: { type: 'title',    id: 't1' } },
    { rank: 2, renownNeeded: 100, reward: { type: 'stashTab', id: 's1' } },
    { rank: 3, renownNeeded: 300, reward: { type: 'frame',    id: 'f1' } },
  ],
};

describe('renownRank — boundaries', () => {
  it('sits on rank 1 at 0 renown, progressing toward rank 2', () => {
    const r = renownRank(0, TRK);
    expect(r.rank).toBe(1);
    expect(r.nextThreshold).toBe(100);
    expect(r.into).toBe(0);
    expect(r.span).toBe(100);
    expect(r.pct).toBe(0);
  });

  it('is mid-band partway to the next rank', () => {
    const r = renownRank(50, TRK);
    expect(r.rank).toBe(1);
    expect(r.into).toBe(50);
    expect(r.pct).toBeCloseTo(0.5, 10);
  });

  it('flips rank EXACTLY at the threshold (>= boundary)', () => {
    const at = renownRank(100, TRK);
    expect(at.rank).toBe(2);
    expect(at.into).toBe(0);          // just crossed — 0 into the new band
    expect(at.nextThreshold).toBe(300);
    expect(at.span).toBe(200);
    // One below the threshold is still the lower rank.
    expect(renownRank(99, TRK).rank).toBe(1);
  });

  it('maxes out on the final rank with no next threshold', () => {
    const r = renownRank(999, TRK);
    expect(r.rank).toBe(3);
    expect(r.nextThreshold).toBeNull();
    expect(r.span).toBe(0);
    expect(r.into).toBe(999 - 300);
    expect(r.pct).toBe(1);
  });

  it('coerces garbage renown to rank 1 (the 0 floor)', () => {
    for (const bad of [null, undefined, NaN, -50, 'x']) {
      const r = renownRank(bad, TRK);
      expect(r.rank).toBe(1);
      expect(r.into).toBe(0);
    }
  });

  it('floors a fractional renown total', () => {
    const r = renownRank(149.9, TRK);
    expect(r.rank).toBe(2);
    expect(r.into).toBe(49); // floor(149.9)=149, 149-100
  });

  it('handles a track whose first rank is above 0 (rank 0 = below the ladder)', () => {
    const gated = { ranks: [{ rank: 1, renownNeeded: 50, reward: { type: 'title', id: 't' } }] };
    const below = renownRank(20, gated);
    expect(below.rank).toBe(0);
    expect(below.nextThreshold).toBe(50);
    expect(below.into).toBe(20);
    expect(below.span).toBe(50);
    expect(below.pct).toBeCloseTo(0.4, 10);
    expect(renownRank(50, gated).rank).toBe(1);
  });

  it('degrades to rank 0 for an empty / garbage track', () => {
    expect(renownRank(500, { ranks: [] })).toEqual({ rank: 0, nextThreshold: null, into: 0, span: 0, pct: 0 });
    expect(renownRank(500, null)).toEqual({ rank: 0, nextThreshold: null, into: 0, span: 0, pct: 0 });
  });

  it('re-sorts an out-of-order track defensively', () => {
    const messy = { ranks: [TRK.ranks[2], TRK.ranks[0], TRK.ranks[1]] };
    const r = renownRank(150, messy);
    expect(r.rank).toBe(2);
    expect(r.nextThreshold).toBe(300);
  });
});

describe('unlockedRewards — accumulates every met rank', () => {
  it('is just rank 1 at the floor', () => {
    expect(unlockedRewards(0, TRK)).toEqual([{ type: 'title', id: 't1' }]);
  });

  it('adds each reward as thresholds are crossed', () => {
    expect(unlockedRewards(100, TRK)).toEqual([
      { type: 'title', id: 't1' },
      { type: 'stashTab', id: 's1' },
    ]);
    expect(unlockedRewards(300, TRK)).toEqual([
      { type: 'title', id: 't1' },
      { type: 'stashTab', id: 's1' },
      { type: 'frame', id: 'f1' },
    ]);
  });

  it('never lists an unearned reward', () => {
    expect(unlockedRewards(99, TRK)).toHaveLength(1);
    expect(unlockedRewards(299, TRK)).toHaveLength(2);
  });

  it('skips a malformed rank with no reward object', () => {
    const t = { ranks: [{ rank: 1, renownNeeded: 0 }, { rank: 2, renownNeeded: 10, reward: { type: 'badge', id: 'b' } }] };
    expect(unlockedRewards(50, t)).toEqual([{ type: 'badge', id: 'b' }]);
  });
});

describe('nextReward', () => {
  it('is the lowest unearned rank\'s reward', () => {
    expect(nextReward(0, TRK)).toEqual({ type: 'stashTab', id: 's1' });
    expect(nextReward(100, TRK)).toEqual({ type: 'frame', id: 'f1' });
  });

  it('is null once every rank is unlocked', () => {
    expect(nextReward(300, TRK)).toBeNull();
    expect(nextReward(9999, TRK)).toBeNull();
  });

  it('is null for an empty track', () => {
    expect(nextReward(0, { ranks: [] })).toBeNull();
  });
});

describe('live RENOWN_TRACK integration', () => {
  it('a fresh account holds rank 1 and its title reward', () => {
    const r = renownRank(0);
    expect(r.rank).toBe(1);
    expect(unlockedRewards(0)).toEqual([RENOWN_TRACK.ranks[0].reward]);
    expect(nextReward(0)).toEqual(RENOWN_TRACK.ranks[1].reward);
  });

  it('a maxed account has claimed every reward and has none pending', () => {
    const top = RENOWN_TRACK.ranks[RENOWN_TRACK.ranks.length - 1].renownNeeded;
    expect(renownRank(top).rank).toBe(RENOWN_TRACK.ranks.length);
    expect(unlockedRewards(top)).toHaveLength(RENOWN_TRACK.ranks.length);
    expect(nextReward(top)).toBeNull();
  });
});
