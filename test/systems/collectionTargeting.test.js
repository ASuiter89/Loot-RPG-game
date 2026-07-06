import { describe, it, expect } from 'vitest';
import { TARGETING } from '../../src/data/targeting.js';
import {
  targetBias,
  isPityGuaranteed,
  shouldRedirect,
  nextPity,
  pityRemaining,
  pickMissingTarget,
  targetStillValid,
} from '../../src/systems/collectionTargeting.js';
import { mulberry32 } from '../../src/utils/rng.js';

describe('targetBias', () => {
  it('starts at baseBias with no pity', () => {
    expect(targetBias(0)).toBeCloseTo(TARGETING.baseBias, 10);
    expect(targetBias(undefined)).toBeCloseTo(TARGETING.baseBias, 10);
  });

  it('climbs by biasPerPity each point, capped at maxBias', () => {
    expect(targetBias(1)).toBeCloseTo(TARGETING.baseBias + TARGETING.biasPerPity, 10);
    // Far below the guarantee but high enough to hit the cap.
    expect(targetBias(TARGETING.guaranteeAt - 1)).toBeLessThanOrEqual(TARGETING.maxBias);
  });

  it('is a hard 1 (certain) at or beyond the guarantee', () => {
    expect(targetBias(TARGETING.guaranteeAt)).toBe(1);
    expect(targetBias(TARGETING.guaranteeAt + 50)).toBe(1);
  });

  it('floors fractional / clamps negative pity', () => {
    expect(targetBias(-3)).toBeCloseTo(TARGETING.baseBias, 10);
    expect(targetBias(2.9)).toBeCloseTo(targetBias(2), 10);
  });

  it('honours a custom tuning object', () => {
    const T = { baseBias: 0.5, biasPerPity: 0.1, maxBias: 0.9, perRunPity: 1, guaranteeAt: 100 };
    expect(targetBias(0, T)).toBeCloseTo(0.5, 10);
    expect(targetBias(10, T)).toBeCloseTo(0.9, 10); // 0.5 + 1.0 capped at 0.9
  });
});

describe('isPityGuaranteed / pityRemaining', () => {
  it('flips true exactly at the threshold', () => {
    expect(isPityGuaranteed(TARGETING.guaranteeAt - 1)).toBe(false);
    expect(isPityGuaranteed(TARGETING.guaranteeAt)).toBe(true);
  });

  it('counts down to the guarantee and floors at 0', () => {
    expect(pityRemaining(0)).toBe(TARGETING.guaranteeAt);
    expect(pityRemaining(TARGETING.guaranteeAt)).toBe(0);
    expect(pityRemaining(TARGETING.guaranteeAt + 5)).toBe(0);
  });
});

describe('shouldRedirect', () => {
  it('is always true once guaranteed, regardless of rng', () => {
    expect(shouldRedirect(() => 0.999999, TARGETING.guaranteeAt)).toBe(true);
  });

  it('is false when the roll exceeds the bias', () => {
    expect(shouldRedirect(() => 0.99, 0)).toBe(false);
  });

  it('is true when the roll is under the bias', () => {
    expect(shouldRedirect(() => 0.0, 0)).toBe(true);
  });

  it('tolerates a missing rng (treats as 0 → redirect within any positive bias)', () => {
    expect(shouldRedirect(undefined, 0)).toBe(true);
  });
});

describe('nextPity', () => {
  it('resets to 0 when the target was obtained', () => {
    expect(nextPity(7, true)).toBe(0);
  });

  it('grows by perRunPity on a miss', () => {
    expect(nextPity(3, false)).toBe(3 + TARGETING.perRunPity);
  });

  it('clamps garbage input to a clean integer', () => {
    expect(nextPity(-4, false)).toBe(TARGETING.perRunPity);
    expect(nextPity(2.8, false)).toBe(2 + TARGETING.perRunPity);
  });
});

describe('pickMissingTarget', () => {
  const catalog = ['u:a', 'u:b', 's:c', 's:d'];

  it('returns null when nothing is missing', () => {
    expect(pickMissingTarget(catalog, new Set(catalog), mulberry32(1))).toBeNull();
  });

  it('only ever returns a missing key', () => {
    const owned = new Set(['u:a', 's:c']);
    const rng = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const k = pickMissingTarget(catalog, owned, rng);
      expect(['u:b', 's:d']).toContain(k);
    }
  });

  it('accepts a plain array as the owned set and tolerates empties', () => {
    expect(pickMissingTarget(catalog, ['u:a', 'u:b', 's:c', 's:d'], mulberry32(1))).toBeNull();
    expect(pickMissingTarget([], new Set(), mulberry32(1))).toBeNull();
    expect(pickMissingTarget(null, null, mulberry32(1))).toBeNull();
  });

  it('is deterministic under a seeded rng', () => {
    const owned = new Set(['u:a']);
    expect(pickMissingTarget(catalog, owned, mulberry32(7)))
      .toBe(pickMissingTarget(catalog, owned, mulberry32(7)));
  });
});

describe('targetStillValid', () => {
  const catalog = ['u:a', 'u:b', 's:c'];
  it('is true for a catalogued, unowned key', () => {
    expect(targetStillValid('u:b', catalog, new Set(['u:a']))).toBe(true);
  });
  it('is false once owned', () => {
    expect(targetStillValid('u:a', catalog, new Set(['u:a']))).toBe(false);
  });
  it('is false for an unknown key or no target', () => {
    expect(targetStillValid('u:zzz', catalog, new Set())).toBe(false);
    expect(targetStillValid(null, catalog, new Set())).toBe(false);
  });
});
