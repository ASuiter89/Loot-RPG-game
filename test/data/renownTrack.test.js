import { describe, it, expect } from 'vitest';
import { RENOWN_TRACK, RENOWN_TITLES } from '../../src/data/renownTrack.js';
import { TITLES } from '../../src/data/titles.js';

const REWARD_TYPES = new Set(['stashTab', 'frame', 'badge', 'title', 'qol']);

describe('RENOWN_TRACK data shape', () => {
  it('has a healthy ladder of ranks', () => {
    expect(Array.isArray(RENOWN_TRACK.ranks)).toBe(true);
    expect(RENOWN_TRACK.ranks.length).toBeGreaterThanOrEqual(8);
  });

  it('numbers ranks 1..N in order', () => {
    RENOWN_TRACK.ranks.forEach((r, i) => {
      expect(r.rank).toBe(i + 1);
    });
  });

  it('opens at 0 so a fresh account already holds rank 1', () => {
    expect(RENOWN_TRACK.ranks[0].renownNeeded).toBe(0);
  });

  it('has STRICTLY ASCENDING cumulative renownNeeded', () => {
    for (let i = 1; i < RENOWN_TRACK.ranks.length; i++) {
      expect(RENOWN_TRACK.ranks[i].renownNeeded)
        .toBeGreaterThan(RENOWN_TRACK.ranks[i - 1].renownNeeded);
    }
  });

  it('gives every rank a power-free reward with a known type and an id', () => {
    for (const r of RENOWN_TRACK.ranks) {
      expect(r.reward).toBeTruthy();
      expect(REWARD_TYPES.has(r.reward.type), r.reward.type).toBe(true);
      expect(typeof r.reward.id).toBe('string');
      expect(r.reward.id.length).toBeGreaterThan(0);
    }
  });

  it('every title reward references a real TITLES id', () => {
    const titleIds = new Set(TITLES.map((t) => t.id));
    for (const r of RENOWN_TRACK.ranks) {
      if (r.reward.type === 'title') expect(titleIds.has(r.reward.id), r.reward.id).toBe(true);
    }
  });

  it('re-exports the TITLES table as RENOWN_TITLES (single source of truth)', () => {
    expect(RENOWN_TITLES).toBe(TITLES);
  });
});
