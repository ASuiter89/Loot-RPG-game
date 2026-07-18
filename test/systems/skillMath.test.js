import { describe, it, expect } from 'vitest';
import {
  milestonePower, rankScale, passiveMilestonePower, passiveRankScale, skillManaCost,
  earnedSkillPoints, earnedAscPoints, ASCEND_LEVEL, ASC_POINT_EVERY,
  PASSIVE_MAX_RANK, passiveSurgeLive,
} from '../../src/systems/skillMath.js';

describe('milestonePower', () => {
  it('is 0 below rank 3', () => {
    expect(milestonePower(0)).toBe(0);
    expect(milestonePower(2)).toBe(0);
  });
  it('adds cumulative spikes at 3, 7 and 10', () => {
    expect(milestonePower(3)).toBeCloseTo(0.28, 10);
    expect(milestonePower(6)).toBeCloseTo(0.28, 10);
    expect(milestonePower(7)).toBeCloseTo(0.48, 10);
    expect(milestonePower(9)).toBeCloseTo(0.48, 10);
    expect(milestonePower(10)).toBeCloseTo(0.78, 10);
    expect(milestonePower(99)).toBeCloseTo(0.78, 10);
  });
});

describe('rankScale', () => {
  it('treats rank 0 and 1 as the baseline 1.0', () => {
    expect(rankScale(0)).toBeCloseTo(1, 10);
    expect(rankScale(1)).toBeCloseTo(1, 10);
  });
  it('grows ~12% per rank before milestones', () => {
    expect(rankScale(2)).toBeCloseTo(1.12, 10);
  });
  it('layers milestone spikes on top', () => {
    // rank 3: (1 + 0.12*2) * (1 + 0.28)
    expect(rankScale(3)).toBeCloseTo(1.24 * 1.28, 10);
    // rank 10: (1 + 0.12*9) * (1 + 0.78)
    expect(rankScale(10)).toBeCloseTo(2.08 * 1.78, 10);
  });
});

describe('passiveMilestonePower', () => {
  it('is 0 below rank 3 (no surge yet)', () => {
    expect(passiveMilestonePower(0)).toBe(0);
    expect(passiveMilestonePower(2)).toBe(0);
  });
  it('adds gentler cumulative spikes at 3, 7 and 10', () => {
    expect(passiveMilestonePower(3)).toBeCloseTo(0.08, 10);
    expect(passiveMilestonePower(6)).toBeCloseTo(0.08, 10);
    expect(passiveMilestonePower(7)).toBeCloseTo(0.18, 10);
    expect(passiveMilestonePower(9)).toBeCloseTo(0.18, 10);
    expect(passiveMilestonePower(10)).toBeCloseTo(0.30, 10);
    expect(passiveMilestonePower(99)).toBeCloseTo(0.30, 10);
  });
  it('stays gentler than the active-skill spikes at every milestone', () => {
    for (const r of [3, 7, 10]) expect(passiveMilestonePower(r)).toBeLessThan(milestonePower(r));
  });
});

describe('passiveRankScale', () => {
  it('is a flat 1.0 through ranks 0–2 (and guards a missing rank)', () => {
    expect(passiveRankScale(undefined)).toBeCloseTo(1, 10);
    expect(passiveRankScale(0)).toBeCloseTo(1, 10);
    expect(passiveRankScale(2)).toBeCloseTo(1, 10);
  });
  it('is 1 + the milestone surge from rank 3 up', () => {
    expect(passiveRankScale(3)).toBeCloseTo(1.08, 10);
    expect(passiveRankScale(7)).toBeCloseTo(1.18, 10);
    expect(passiveRankScale(10)).toBeCloseTo(1.30, 10);
  });
});

describe('passiveSurgeLive', () => {
  it('the base-tree passive cap is rank 10', () => {
    expect(PASSIVE_MAX_RANK).toBe(10);
  });
  it('is false below max rank, true at or past it', () => {
    expect(passiveSurgeLive(0)).toBe(false);
    expect(passiveSurgeLive(9)).toBe(false);
    expect(passiveSurgeLive(10)).toBe(true);
    expect(passiveSurgeLive(11)).toBe(true);
  });
  it('guards a missing rank', () => {
    expect(passiveSurgeLive(undefined)).toBe(false);
    expect(passiveSurgeLive(null)).toBe(false);
  });
  it('honours a custom max — a single-rank keystone surges at rank 1', () => {
    expect(passiveSurgeLive(1, 1)).toBe(true);
    expect(passiveSurgeLive(0, 1)).toBe(false);
    // a falsy max falls back to the base cap
    expect(passiveSurgeLive(10, 0)).toBe(true);
    expect(passiveSurgeLive(9, 0)).toBe(false);
  });
});

describe('skillManaCost', () => {
  it('is 0 for a missing node or a node with no mp cost', () => {
    expect(skillManaCost(null, 3)).toBe(0);
    expect(skillManaCost({}, 3)).toBe(0);
    expect(skillManaCost({ mp: 0 }, 3)).toBe(0);
  });
  it('applies the global multiplier at rank 1', () => {
    expect(skillManaCost({ mp: 10 }, 1)).toBe(15); // 10 * 1.5
  });
  it('treats rank 0 as rank 1', () => {
    expect(skillManaCost({ mp: 10 }, 0)).toBe(15);
  });
  it('climbs 8% of base per rank above the first', () => {
    expect(skillManaCost({ mp: 10 }, 2)).toBe(16); // round(15 * 1.08)
    expect(skillManaCost({ mp: 10 }, 5)).toBe(20); // round(15 * 1.32)
    expect(skillManaCost({ mp: 20 }, 10)).toBe(52); // round(30 * 1.72)
  });
  it('never returns below 1 for a real cost', () => {
    expect(skillManaCost({ mp: 1 }, 1)).toBeGreaterThanOrEqual(1);
  });
});

describe('earnedSkillPoints', () => {
  it('grants no point at creation (level 1) — the first is earned at level 2', () => {
    expect(earnedSkillPoints(1)).toBe(0);
    expect(earnedSkillPoints(0)).toBe(0); // guards a missing/zero level
  });
  it('adds one per level gained above the first', () => {
    expect(earnedSkillPoints(2)).toBe(1);
    expect(earnedSkillPoints(20)).toBe(19);
    expect(earnedSkillPoints(50)).toBe(49);
  });
});

describe('earnedAscPoints', () => {
  it('is 0 below the ascension level', () => {
    expect(earnedAscPoints(1)).toBe(0);
    expect(earnedAscPoints(ASCEND_LEVEL - 1)).toBe(0);
    expect(earnedAscPoints(0)).toBe(0);
  });
  it('grants the first point at the ascension level', () => {
    expect(earnedAscPoints(ASCEND_LEVEL)).toBe(1);
  });
  it('adds one more every ASC_POINT_EVERY levels', () => {
    expect(earnedAscPoints(ASCEND_LEVEL + 1)).toBe(1); // not yet the next tier
    expect(earnedAscPoints(ASCEND_LEVEL + ASC_POINT_EVERY - 1)).toBe(1);
    expect(earnedAscPoints(ASCEND_LEVEL + ASC_POINT_EVERY)).toBe(2);
    expect(earnedAscPoints(ASCEND_LEVEL + 2 * ASC_POINT_EVERY)).toBe(3);
  });
  it('matches the intended cadence (20→1, 25→2, 30→3, 50→7)', () => {
    expect(earnedAscPoints(20)).toBe(1);
    expect(earnedAscPoints(25)).toBe(2);
    expect(earnedAscPoints(30)).toBe(3);
    expect(earnedAscPoints(50)).toBe(7);
  });
});
