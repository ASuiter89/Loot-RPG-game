import { describe, it, expect } from 'vitest';
import { CYCLES } from '../../src/data/cycles.js';
import {
  activeCycle,
  cycleById,
  isCycleLive,
  cycleJourneyProgress,
  cycleJourneyComplete,
  cycleRewardsEarned,
  cycleRankReward,
} from '../../src/systems/cycles.js';

// Reference epoch-ms derived from the shipped registry so the fixed nowMs values below
// are pinned to the real windows (parsing an ISO string in a test is fine — it's not
// reading the clock).
const S3 = CYCLES.find((c) => c.id === 's3_stormcrown');
const S1 = CYCLES.find((c) => c.id === 's1_emberfall');
const S4 = CYCLES.find((c) => c.id === 's4_dawnforge');

const s3Start = Date.parse(S3.startISO);
const s3End = Date.parse(S3.endISO);
const s1Start = Date.parse(S1.startISO);
const s2End = Date.parse(CYCLES.find((c) => c.id === 's2_frostwake').endISO);
const s4Start = Date.parse(S4.startISO);
const s4End = Date.parse(S4.endISO);

const DAY = 86400000;

// A tiny 2-cycle table to exercise activeCycle branches in isolation.
const TABLE = [
  { id: 'a', startISO: '2020-01-01T00:00:00Z', endISO: '2020-02-01T00:00:00Z', journey: [], rewardTiers: [] },
  { id: 'b', startISO: '2020-03-01T00:00:00Z', endISO: '2020-04-01T00:00:00Z', journey: [], rewardTiers: [] },
];
const A_START = Date.parse('2020-01-01T00:00:00Z');
const A_END = Date.parse('2020-02-01T00:00:00Z');
const B_START = Date.parse('2020-03-01T00:00:00Z');

describe('cycleById', () => {
  it('finds a cycle by id in the default registry', () => {
    expect(cycleById('s3_stormcrown').id).toBe('s3_stormcrown');
  });
  it('returns null for a missing / falsy id or bad table', () => {
    expect(cycleById('nope')).toBeNull();
    expect(cycleById(null)).toBeNull();
    expect(cycleById(undefined)).toBeNull();
    expect(cycleById('a', 42)).toBeNull();
  });
  it('honours a custom table', () => {
    expect(cycleById('b', TABLE).id).toBe('b');
  });
});

describe('isCycleLive', () => {
  it('is true strictly inside the window (start inclusive, end exclusive)', () => {
    expect(isCycleLive(S3, s3Start)).toBe(true);            // start inclusive
    expect(isCycleLive(S3, s3Start + DAY)).toBe(true);
    expect(isCycleLive(S3, s3End)).toBe(false);             // end exclusive
    expect(isCycleLive(S3, s3End - 1)).toBe(true);
  });
  it('is false before/after and for null / unparseable cycles', () => {
    expect(isCycleLive(S3, s3Start - 1)).toBe(false);
    expect(isCycleLive(null, s3Start)).toBe(false);
    expect(isCycleLive({ startISO: 'x', endISO: 'y' }, s3Start)).toBe(false);
  });
  it('treats garbage nowMs as epoch 0 (before every real season)', () => {
    expect(isCycleLive(S3, NaN)).toBe(false);
    expect(isCycleLive(S3, undefined)).toBe(false);
  });
});

describe('activeCycle — phases from a fixed nowMs', () => {
  it('LIVE: nowMs inside s3 returns s3 with countdown to its end', () => {
    const now = s3Start + 10 * DAY;
    const r = activeCycle(now);
    expect(r.phase).toBe('live');
    expect(r.cycle.id).toBe('s3_stormcrown');
    expect(r.countdownMs).toBe(s3End - now);
  });

  it('PRE (before all): nowMs before s1 returns s1 with countdown to its start', () => {
    const now = s1Start - 5 * DAY;
    const r = activeCycle(now);
    expect(r.phase).toBe('pre');
    expect(r.cycle.id).toBe('s1_emberfall');
    expect(r.countdownMs).toBe(s1Start - now);
  });

  it('PRE (gap): nowMs after s2 ends but before s3 opens targets the next upcoming season', () => {
    const now = s2End + 30 * DAY; // deep in the s2→s3 gap
    const r = activeCycle(now);
    expect(r.phase).toBe('pre');
    expect(r.cycle.id).toBe('s3_stormcrown');
    expect(r.countdownMs).toBe(s3Start - now);
  });

  it('ENDED: nowMs after the final season returns the last one with zero countdown', () => {
    const now = s4End + 100 * DAY;
    const r = activeCycle(now);
    expect(r.phase).toBe('ended');
    expect(r.cycle.id).toBe('s4_dawnforge');
    expect(r.countdownMs).toBe(0);
  });

  it('boundary: exactly at s4 start is LIVE, exactly at s4 end is ENDED', () => {
    expect(activeCycle(s4Start).phase).toBe('live');
    expect(activeCycle(s4Start).cycle.id).toBe('s4_dawnforge');
    expect(activeCycle(s4End).phase).toBe('ended');
  });

  it('garbage nowMs collapses to epoch 0 ⇒ pre on the first season', () => {
    expect(activeCycle(undefined).phase).toBe('pre');
    expect(activeCycle(NaN).cycle.id).toBe('s1_emberfall');
  });

  it('custom table: live / pre-gap / ended branches', () => {
    expect(activeCycle(A_START + DAY, TABLE)).toMatchObject({ phase: 'live', countdownMs: A_END - (A_START + DAY) });
    // between a and b → pre, pointing at b
    const gap = A_END + DAY;
    expect(activeCycle(gap, TABLE)).toMatchObject({ phase: 'pre' });
    expect(activeCycle(gap, TABLE).cycle.id).toBe('b');
    expect(activeCycle(gap, TABLE).countdownMs).toBe(B_START - gap);
    // after b → ended, last is b
    expect(activeCycle(Date.parse('2021-01-01T00:00:00Z'), TABLE)).toMatchObject({ phase: 'ended', countdownMs: 0 });
  });

  it('empty / non-array / all-garbage tables return ended with a null cycle', () => {
    expect(activeCycle(1000, [])).toEqual({ cycle: null, countdownMs: 0, phase: 'ended' });
    expect(activeCycle(1000, null)).toEqual({ cycle: null, countdownMs: 0, phase: 'ended' });
    const bad = [{ id: 'x', startISO: 'nope', endISO: 'nope' }, null];
    expect(activeCycle(1000, bad)).toEqual({ cycle: null, countdownMs: 0, phase: 'ended' });
  });

  it('is deterministic given nowMs', () => {
    const now = s3Start + 3 * DAY;
    expect(activeCycle(now)).toEqual(activeCycle(now));
  });
});

describe('cycleJourneyProgress', () => {
  // A snapshot that clears the early bounty-kind milestones of s3 (delve 5, slay 100,
  // clear 3) but not the deeper ones.
  const totals = { kills: 150, maxFloor: 8, clearedFloors: 4, bossKills: 0, eliteKills: 2, goldEarned: 1200, journeyPoints: 10 };

  it('returns one row per milestone with have/need/done from the snapshot', () => {
    const prog = cycleJourneyProgress(totals, S3);
    expect(prog).toHaveLength(S3.journey.length);
    const byId = Object.fromEntries(prog.map((p) => [p.id, p]));
    // delve 5 vs maxFloor 8 → done
    expect(byId.s3_j01).toMatchObject({ have: 8, need: 5, done: true });
    // slay 100 vs kills 150 → done
    expect(byId.s3_j02).toMatchObject({ have: 150, need: 100, done: true });
    // boss 1 vs bossKills 0 → not done
    expect(byId.s3_j05).toMatchObject({ have: 0, need: 1, done: false });
    // custom capstone reads totals.journeyPoints (10) vs need 100 → not done
    expect(byId.s3_j15).toMatchObject({ have: 10, need: 100, done: false });
  });

  it('reuses the bounty delta mapping for each kind', () => {
    // delve uses absolute maxFloor; gold uses goldEarned; elite uses eliteKills.
    const prog = cycleJourneyProgress({ maxFloor: 20, goldEarned: 5000, eliteKills: 10 }, S3);
    const byId = Object.fromEntries(prog.map((p) => [p.id, p]));
    expect(byId.s3_j08).toMatchObject({ have: 20, need: 20, done: true });  // delve 20
    expect(byId.s3_j06).toMatchObject({ have: 5000, need: 5000, done: true }); // gold 5000
    expect(byId.s3_j07).toMatchObject({ have: 10, need: 10, done: true });  // elite 10
  });

  it('treats missing / garbage totals as 0 (fresh character, nothing done)', () => {
    const prog = cycleJourneyProgress(undefined, S3);
    expect(prog.every((p) => p.have === 0 && p.done === false)).toBe(true);
    const prog2 = cycleJourneyProgress({ kills: -50, maxFloor: NaN, goldEarned: 'x' }, S3);
    expect(prog2.every((p) => p.have === 0)).toBe(true);
  });

  it('returns [] for a null cycle or a cycle with no journey', () => {
    expect(cycleJourneyProgress(totals, null)).toEqual([]);
    expect(cycleJourneyProgress(totals, { id: 'z' })).toEqual([]);
  });

  it('handles an unknown kind and a custom step with no field as have 0', () => {
    const cycle = { journey: [
      { id: 'w', kind: 'weird', need: 1 },
      { id: 'c', kind: 'custom', need: 1 }, // no field
      { id: 'z', kind: 'slay', need: 0 },   // need 0 → done at have 0
    ] };
    const prog = cycleJourneyProgress({ kills: 0 }, cycle);
    expect(prog[0]).toMatchObject({ have: 0, done: false }); // need 1
    expect(prog[1]).toMatchObject({ have: 0, done: false });
    expect(prog[2]).toMatchObject({ have: 0, need: 0, done: true });
  });

  it('coerces a non-finite need to 0 (already done)', () => {
    const cycle = { journey: [{ id: 'q', kind: 'slay', need: 'oops' }] };
    expect(cycleJourneyProgress({ kills: 0 }, cycle)[0]).toMatchObject({ need: 0, done: true });
  });
});

describe('cycleJourneyComplete', () => {
  it('is false while any milestone is unfinished', () => {
    expect(cycleJourneyComplete({ kills: 1 }, S3)).toBe(false);
  });

  it('is true only when EVERY milestone is met', () => {
    const maxed = {
      kills: 100000, maxFloor: 999, clearedFloors: 999,
      bossKills: 999, eliteKills: 999, goldEarned: 9999999, journeyPoints: 999,
    };
    expect(cycleJourneyComplete(maxed, S3)).toBe(true);
  });

  it('is false for an empty / absent journey (nothing to complete)', () => {
    expect(cycleJourneyComplete({}, { journey: [] })).toBe(false);
    expect(cycleJourneyComplete({}, null)).toBe(false);
  });
});

describe('cycleRewardsEarned', () => {
  it('returns { id, reward } for each completed milestone only', () => {
    const totals = { maxFloor: 5, kills: 0 }; // clears only s3_j01 (delve 5)
    const prog = cycleJourneyProgress(totals, S3);
    const earned = cycleRewardsEarned(prog, S3);
    expect(earned).toHaveLength(1);
    expect(earned[0].id).toBe('s3_j01');
    expect(earned[0].reward).toEqual(S3.journey[0].reward);
  });

  it('returns every reward once the whole journey is done', () => {
    const maxed = {
      kills: 1e9, maxFloor: 1e9, clearedFloors: 1e9,
      bossKills: 1e9, eliteKills: 1e9, goldEarned: 1e9, journeyPoints: 1e9,
    };
    const prog = cycleJourneyProgress(maxed, S3);
    expect(cycleRewardsEarned(prog, S3)).toHaveLength(S3.journey.length);
  });

  it('returns [] for null / non-array progress or a cycle with no journey', () => {
    expect(cycleRewardsEarned(null, S3)).toEqual([]);
    expect(cycleRewardsEarned([], null)).toEqual([]);
    expect(cycleRewardsEarned([{ id: 'x', done: true }], { id: 'z' })).toEqual([]);
  });

  it('skips done rows whose id matches no step, or a matched step with no reward', () => {
    const cycle = { journey: [
      { id: 'a', kind: 'slay', need: 1, reward: { type: 'gold' } },
      { id: 'b', kind: 'slay', need: 1 }, // no reward
    ] };
    const prog = [
      { id: 'a', have: 1, need: 1, done: true },
      { id: 'b', have: 1, need: 1, done: true },
      { id: 'ghost', have: 1, need: 1, done: true }, // no such step
      { id: 'a', have: 0, need: 1, done: false },    // not done → ignored
    ];
    const earned = cycleRewardsEarned(prog, cycle);
    expect(earned).toEqual([{ id: 'a', reward: { type: 'gold' } }]);
  });
});

describe('cycleRankReward', () => {
  it('returns the most prestigious tier a final rank qualifies for', () => {
    expect(cycleRankReward(1, S3)).toEqual(S3.rewardTiers[0]);   // rank 1 → the top tier
    expect(cycleRankReward(5, S3).rank).toBe(10);                // between 1 and 10 → top-10 tier
    expect(cycleRankReward(10, S3).rank).toBe(10);               // inclusive cutoff
    expect(cycleRankReward(11, S3).rank).toBe(100);              // next tier down
    expect(cycleRankReward(1000, S3).rank).toBe(1000);           // last tier
  });

  it('returns null when placed outside every tier or given a bad rank', () => {
    expect(cycleRankReward(100000, S3)).toBeNull();
    expect(cycleRankReward(0, S3)).toBeNull();
    expect(cycleRankReward(-3, S3)).toBeNull();
    expect(cycleRankReward(NaN, S3)).toBeNull();
    expect(cycleRankReward(1, null)).toBeNull();
    expect(cycleRankReward(1, { rewardTiers: [] })).toBeNull();
  });

  it('ignores malformed tiers and still picks the best valid one', () => {
    const cycle = { rewardTiers: [
      { rank: 'x', reward: { type: 'junk' } }, // malformed → ignored
      { rank: 50, reward: { type: 'cache' } },
      { rank: 5, reward: { type: 'title' } },
    ] };
    expect(cycleRankReward(3, cycle).rank).toBe(5);
    expect(cycleRankReward(40, cycle).rank).toBe(50);
  });
});
