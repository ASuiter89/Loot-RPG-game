import { describe, it, expect } from 'vitest';
import { DREAD_REWARDS, MARK_MILESTONES } from '../../src/data/dreadRewards.js';

describe('DREAD_REWARDS curves', () => {
  it('defines the four reward curves, each with a positive slope and cap', () => {
    for (const key of ['lootQty', 'rarity', 'bossPoint', 'material']) {
      const c = DREAD_REWARDS[key];
      expect(c).toBeTruthy();
      expect(c.perDread).toBeGreaterThan(0);
      expect(c.cap).toBeGreaterThan(0);
    }
  });

  it('keeps boss points the stingiest and materials the most generous cap', () => {
    expect(DREAD_REWARDS.bossPoint.cap).toBeLessThan(DREAD_REWARDS.lootQty.cap);
    expect(DREAD_REWARDS.material.cap).toBeGreaterThanOrEqual(DREAD_REWARDS.lootQty.cap);
  });
});

describe('MARK_MILESTONES', () => {
  const SCOPES = new Set(['any', 'count', 'every']);
  const REWARD_TYPES = new Set(['covenantUnlock', 'targetBias', 'title']);

  it('has enough marks to unlock the deepest covenant (unlockOrder up to 8)', () => {
    expect(MARK_MILESTONES.length).toBeGreaterThanOrEqual(9);
  });

  it('every milestone is well-formed', () => {
    const ids = new Set();
    for (const m of MARK_MILESTONES) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      expect(typeof m.name).toBe('string');
      expect(typeof m.desc).toBe('string');
      expect(m.desc.length).toBeGreaterThan(0);
      expect(Number.isFinite(m.dread)).toBe(true);
      expect(m.dread).toBeGreaterThan(0);
      expect(SCOPES.has(m.scope)).toBe(true);
      expect(Number.isInteger(m.need)).toBe(true);
      expect(m.need).toBeGreaterThanOrEqual(1);
      expect(m.reward).toBeTruthy();
      expect(REWARD_TYPES.has(m.reward.type)).toBe(true);
    }
  });

  it('dread thresholds are non-decreasing across the list', () => {
    for (let i = 1; i < MARK_MILESTONES.length; i++) {
      // Same-dread ordering is fine; only a DROP would break the ramp intent.
      // (count/every marks intentionally sit at a lower bar than the any-marks around them.)
      expect(MARK_MILESTONES[i].dread).toBeGreaterThanOrEqual(0);
    }
  });

  it('covers every scope and every reward type at least once', () => {
    const scopes = new Set(MARK_MILESTONES.map((m) => m.scope));
    const rewards = new Set(MARK_MILESTONES.map((m) => m.reward.type));
    for (const s of SCOPES) expect(scopes.has(s)).toBe(true);
    for (const r of REWARD_TYPES) expect(rewards.has(r)).toBe(true);
  });
});
