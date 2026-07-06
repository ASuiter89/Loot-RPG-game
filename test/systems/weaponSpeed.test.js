import { describe, it, expect } from 'vitest';
import { SPEED_TIERS, baseAttacksPerSec, speedTier, weaponSpeedInfo } from '../../src/systems/weaponSpeed.js';

// The live combat cadence this module mirrors (PLAYER_ATK_BASE × STYLE_ATK_MULT
// in src/legacy/game.js). Pinned here so the tier mapping is asserted against the
// same numbers the game swings at — if a style multiplier moves, this drifts and
// the mapping test flags it.
const PLAYER_ATK_BASE = 1.5;
const STYLE_ATK_MULT = { flurry: 0.7, slash: 1, cleave: 1.25, crush: 1.4, reap: 1.2, thrust: 1.05, shot: 1.05, bolt: 1.15, fist: 0.85 };

describe('baseAttacksPerSec', () => {
  it('is the reciprocal of interval × multiplier', () => {
    expect(baseAttacksPerSec(1, 1.5)).toBeCloseTo(0.6667, 4);
    expect(baseAttacksPerSec(0.7, 1.5)).toBeCloseTo(0.9524, 4);
    expect(baseAttacksPerSec(1.4, 1.5)).toBeCloseTo(0.4762, 4);
  });
  it('a bigger multiplier is a slower swing (fewer attacks/sec)', () => {
    expect(baseAttacksPerSec(1.4, 1.5)).toBeLessThan(baseAttacksPerSec(0.7, 1.5));
  });
  it('guards a non-positive multiplier or interval to the baseline (never divides by zero)', () => {
    expect(baseAttacksPerSec(0, 1.5)).toBeCloseTo(1 / 1.5, 6);
    expect(baseAttacksPerSec(-2, 1.5)).toBeCloseTo(1 / 1.5, 6);
    expect(baseAttacksPerSec(1, 0)).toBe(1);
    expect(Number.isFinite(baseAttacksPerSec(0, 0))).toBe(true);
  });
});

describe('speedTier', () => {
  it('labels at and around each boundary', () => {
    expect(speedTier(0.95)).toBe('Fast');
    expect(speedTier(0.75)).toBe('Fast');   // inclusive floor
    expect(speedTier(0.74)).toBe('Normal');
    expect(speedTier(0.60)).toBe('Normal');  // inclusive floor
    expect(speedTier(0.59)).toBe('Slow');
    expect(speedTier(0)).toBe('Slow');
  });
  it('falls back to the slowest tier for a negative value', () => {
    expect(speedTier(-1)).toBe('Slow');
  });
});

describe('weaponSpeedInfo', () => {
  it('returns both the attacks/sec and its tier', () => {
    const info = weaponSpeedInfo(1, 1.5);
    expect(info.aps).toBeCloseTo(0.6667, 4);
    expect(info.tier).toBe('Normal');
  });

  // The shipped styles must land in intuitive tiers: light flurry weapons Fast,
  // the 1H melee/ranged middle Normal, heavy two-handers + casters Slow.
  const EXPECTED_TIER = {
    flurry: 'Fast', fist: 'Fast',
    slash: 'Normal', thrust: 'Normal', shot: 'Normal',
    bolt: 'Slow', reap: 'Slow', cleave: 'Slow', crush: 'Slow',
  };
  for (const [style, tier] of Object.entries(EXPECTED_TIER)) {
    it(`maps ${style} → ${tier}`, () => {
      expect(weaponSpeedInfo(STYLE_ATK_MULT[style], PLAYER_ATK_BASE).tier).toBe(tier);
    });
  }
});

describe('SPEED_TIERS', () => {
  it('is ordered high → low and ends at a zero floor so every non-negative aps maps', () => {
    for (let i = 1; i < SPEED_TIERS.length; i++) {
      expect(SPEED_TIERS[i].min).toBeLessThan(SPEED_TIERS[i - 1].min);
    }
    expect(SPEED_TIERS[SPEED_TIERS.length - 1].min).toBe(0);
  });
});
