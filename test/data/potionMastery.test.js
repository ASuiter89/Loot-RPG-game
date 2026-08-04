import { describe, it, expect } from 'vitest';
import {
  POTION_POWER_MAX, POTION_CD_MAX,
  POTION_PCT_PER_LVL, POTION_CD_PER_LVL, POTION_CD_MIN,
  POTION_UPGRADE_BASE_COST, POTION_UPGRADE_COST_GROWTH,
} from '../../src/data/potionMastery.js';

// Mirrors potionUpgradeCost() in the game shell — the shell reads the same two
// constants, so pinning the curve here pins what the Healer charges.
const cost = (lvl) => Math.round(POTION_UPGRADE_BASE_COST * Math.pow(POTION_UPGRADE_COST_GROWTH, lvl));

describe('potion mastery tuning', () => {
  it('caps both tracks at a small, whole number of ranks', () => {
    for (const max of [POTION_POWER_MAX, POTION_CD_MAX]) {
      expect(Number.isInteger(max)).toBe(true);
      expect(max).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(10);
    }
  });

  it('five Recharge ranks take a flask from 6s to exactly the 5s floor', () => {
    const BASE_CD = 6; // POTION_CD in the game shell
    expect(POTION_CD_PER_LVL).toBe(0.2);
    expect(POTION_CD_MAX).toBe(5);
    expect(BASE_CD - POTION_CD_PER_LVL * POTION_CD_MAX).toBeCloseTo(POTION_CD_MIN);
    expect(POTION_CD_MIN).toBe(5);
  });

  it('never lets a flask recharge instantly', () => {
    expect(POTION_CD_MIN).toBeGreaterThan(0);
  });

  it('maxed Potency lands under a full-restore sip', () => {
    expect(POTION_PCT_PER_LVL).toBeGreaterThan(0);
    expect(0.35 + POTION_PCT_PER_LVL * POTION_POWER_MAX).toBeLessThan(1); // 35% base heal
  });

  it('prices the first rank at the discounted base and climbs steeply', () => {
    expect(POTION_UPGRADE_BASE_COST).toBe(9000);
    expect(cost(0)).toBe(9000);
    expect(cost(1)).toBe(22500);
    expect(POTION_UPGRADE_COST_GROWTH).toBeGreaterThan(1);
  });
});
