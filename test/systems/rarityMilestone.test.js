import { describe, it, expect } from 'vitest';
import {
  MILESTONE_TIERS, MILESTONE_KICKER, firstRarityMilestone, seedMilestones,
} from '../../src/systems/rarityMilestone.js';

describe('firstRarityMilestone', () => {
  it('celebrates the first green/blue/purple pickup', () => {
    expect(firstRarityMilestone({ tier: 'uncommon' }, {})).toBe('uncommon');
    expect(firstRarityMilestone({ tier: 'rare' }, {})).toBe('rare');
    expect(firstRarityMilestone({ tier: 'epic' }, {})).toBe('epic');
  });

  it('never re-celebrates a tier already in the ledger', () => {
    expect(firstRarityMilestone({ tier: 'uncommon' }, { uncommon: 1 })).toBeNull();
    expect(firstRarityMilestone({ tier: 'rare' }, { uncommon: 1, rare: 1 })).toBeNull();
    expect(firstRarityMilestone({ tier: 'epic' }, { epic: 1 })).toBeNull();
  });

  it('ignores the always-banner top tiers and the baseline tiers', () => {
    for (const tier of ['legendary', 'unique', 'normal', 'junk']) {
      expect(firstRarityMilestone({ tier }, {})).toBeNull();
    }
  });

  it('tolerates a missing item, tier, or ledger', () => {
    expect(firstRarityMilestone(null, {})).toBeNull();
    expect(firstRarityMilestone(undefined, {})).toBeNull();
    expect(firstRarityMilestone({}, {})).toBeNull();
    expect(firstRarityMilestone({ tier: 'rare' }, null)).toBe('rare');
    expect(firstRarityMilestone({ tier: 'rare' }, undefined)).toBe('rare');
  });

  it('every milestone tier carries a kicker label', () => {
    for (const tier of MILESTONE_TIERS) {
      expect(typeof MILESTONE_KICKER[tier]).toBe('string');
      expect(MILESTONE_KICKER[tier].length).toBeGreaterThan(0);
    }
  });
});

describe('seedMilestones', () => {
  it('leaves every milestone tier open for a fresh hero (all colours still locked)', () => {
    const locked = new Set(['uncommon', 'rare', 'epic', 'legendary', 'unique']);
    expect(seedMilestones(locked)).toEqual({});
  });

  it('marks only unlocked colours as already celebrated', () => {
    // Greens unlocked (floor-5 boss down); blues/purples still locked.
    const midLocked = new Set(['rare', 'epic', 'legendary', 'unique']);
    expect(seedMilestones(midLocked)).toEqual({ uncommon: 1 });
  });

  it('marks every milestone tier seen once all colours are unlocked', () => {
    expect(seedMilestones(new Set())).toEqual({ uncommon: 1, rare: 1, epic: 1 });
  });

  it('treats a missing locked set as nothing locked', () => {
    expect(seedMilestones(null)).toEqual({ uncommon: 1, rare: 1, epic: 1 });
  });
});
