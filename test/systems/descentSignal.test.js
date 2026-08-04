import { describe, it, expect } from 'vitest';
import { BOSS_EVERY, isBossDepth, descentDepth, descentSignal } from '../../src/systems/descentSignal.js';

describe('isBossDepth', () => {
  it('marks every fifth floor as a guardian floor', () => {
    expect(BOSS_EVERY).toBe(5);
    expect(isBossDepth(5)).toBe(true);
    expect(isBossDepth(10)).toBe(true);
    expect(isBossDepth(25)).toBe(true);
  });

  it('keeps the cadence across tier boundaries and into endless', () => {
    expect(isBossDepth(50)).toBe(true);
    expect(isBossDepth(75)).toBe(true);
    expect(isBossDepth(80)).toBe(true);   // endless, past the finite depth
    expect(isBossDepth(81)).toBe(false);
  });

  it('is false for ordinary floors and for non-floors', () => {
    expect(isBossDepth(1)).toBe(false);
    expect(isBossDepth(4)).toBe(false);
    expect(isBossDepth(6)).toBe(false);
    expect(isBossDepth(0)).toBe(false);
    expect(isBossDepth(-5)).toBe(false);
    expect(isBossDepth(null)).toBe(false);
    expect(isBossDepth(undefined)).toBe(false);
    expect(isBossDepth('nope')).toBe(false);
  });

  it('floors a fractional depth', () => {
    expect(isBossDepth(5.9)).toBe(true);
    expect(isBossDepth(4.9)).toBe(false);
  });
});

describe('descentDepth', () => {
  it('lands one floor deeper', () => {
    expect(descentDepth(1)).toBe(2);
    expect(descentDepth(4)).toBe(5);
    expect(descentDepth(99)).toBe(100);
  });

  it('returns 0 for a depth that is not a real floor', () => {
    expect(descentDepth(0)).toBe(0);
    expect(descentDepth(-3)).toBe(0);
    expect(descentDepth(NaN)).toBe(0);
  });
});

describe('descentSignal', () => {
  it('flags the descent into a guardian floor', () => {
    expect(descentSignal(4)).toBe('boss');    // 4 → 5
    expect(descentSignal(9)).toBe('boss');    // 9 → 10
    expect(descentSignal(74)).toBe('boss');   // 74 → 75
    expect(descentSignal(79)).toBe('boss');   // endless keeps the cadence
  });

  it('stays normal for an ordinary descent', () => {
    expect(descentSignal(1)).toBe('normal');
    expect(descentSignal(3)).toBe('normal');
    expect(descentSignal(5)).toBe('normal');  // climbing OFF a boss floor is ordinary
    expect(descentSignal(80)).toBe('normal');
  });

  it('ignores whether the floor below was beaten before — guardians respawn', () => {
    // Nothing but the destination depth feeds the signal, so a revisit reads the
    // same warning as a first descent.
    expect(descentSignal(14)).toBe('boss');
    expect(descentSignal(14)).toBe(descentSignal(4));
  });

  it('is normal for a garbage depth rather than throwing', () => {
    expect(descentSignal(null)).toBe('normal');
    expect(descentSignal('x')).toBe('normal');
  });
});
