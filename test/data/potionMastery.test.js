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
  it('caps every track at a small, whole number of ranks', () => {
    for (const max of [POTION_POWER_MAX, POTION_CD_MAX]) {
      expect(Number.isInteger(max)).toBe(true);
      expect(max).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(10);
    }
  });

  it('five Recharge ranks take a flask from 6s to exactly the 4s floor', () => {
    const BASE_CD = 6; // POTION_CD in the game shell
    expect(POTION_CD_PER_LVL).toBe(0.4);
    expect(POTION_CD_MAX).toBe(5);
    expect(BASE_CD - POTION_CD_PER_LVL * POTION_CD_MAX).toBeCloseTo(POTION_CD_MIN);
    expect(POTION_CD_MIN).toBe(4);
  });

  it('walks 6s down to the floor in even steps, no rank wasted on the clamp', () => {
    const curve = Array.from({ length: POTION_CD_MAX + 1 },
      (_, lvl) => Math.round(Math.max(POTION_CD_MIN, 6 - POTION_CD_PER_LVL * lvl) * 10) / 10);
    expect(curve).toEqual([6, 5.6, 5.2, 4.8, 4.4, 4]);
    expect(new Set(curve).size).toBe(curve.length); // every rank buys a real cut
  });

  it('never lets a flask recharge instantly', () => {
    expect(POTION_CD_MIN).toBeGreaterThan(0);
  });

  it('maxed Potency lands under a full-restore sip on EITHER flask', () => {
    expect(POTION_PCT_PER_LVL).toBeGreaterThan(0);
    // HEAL_PERCENT / MANA_PERCENT in the game shell — each flask now has its own
    // Potency track, so both bases have to clear the cap on their own.
    for (const base of [0.35, 0.40]) {
      expect(base + POTION_PCT_PER_LVL * POTION_POWER_MAX).toBeLessThan(1);
    }
  });

  it('prices the first rank at the discounted base and climbs steeply', () => {
    expect(POTION_UPGRADE_BASE_COST).toBe(9000);
    expect(cost(0)).toBe(9000);
    expect(cost(1)).toBe(22500);
    expect(POTION_UPGRADE_COST_GROWTH).toBeGreaterThan(1);
  });
});
