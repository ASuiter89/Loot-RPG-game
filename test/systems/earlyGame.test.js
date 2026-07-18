import { describe, it, expect } from 'vitest';
import {
  MIN_EARLY_HITS, EARLY_HIT_FLOORS,
  earlyHitCapActive, earlyHitDamageCap, capEarlyHit,
} from '../../src/systems/earlyGame.js';

describe('earlyHitCapActive', () => {
  it('is on for the whole beach tutorial regardless of depth number', () => {
    expect(earlyHitCapActive(1, true)).toBe(true);
    expect(earlyHitCapActive(99, true)).toBe(true);
  });

  it('is on for dungeon floors 1..EARLY_HIT_FLOORS', () => {
    for (let dl = 1; dl <= EARLY_HIT_FLOORS; dl++) {
      expect(earlyHitCapActive(dl, false)).toBe(true);
    }
  });

  it('is off past the early floors', () => {
    expect(earlyHitCapActive(EARLY_HIT_FLOORS + 1, false)).toBe(false);
    expect(earlyHitCapActive(10, false)).toBe(false);
  });

  it('is off at depth 0 / non-positive when not in the tutorial', () => {
    expect(earlyHitCapActive(0, false)).toBe(false);
  });
});

describe('earlyHitDamageCap', () => {
  it('guarantees a foe survives its first (MIN_EARLY_HITS - 1) max-capped blows', () => {
    // For every plausible early-foe HP, (minHits - 1) capped blows must not kill it.
    for (let hp = 3; hp <= 400; hp++) {
      const cap = earlyHitDamageCap(hp);
      expect(cap * (MIN_EARLY_HITS - 1)).toBeLessThan(hp);
    }
  });

  it('lets a realistic early foe fall in exactly MIN_EARLY_HITS max-capped blows', () => {
    // Every real early foe carries >=14 HP; across a generous range a foe struck
    // for the full cap each time dies on exactly the MIN_EARLY_HITS-th blow — no
    // spongy 4th hit. (Below ~5 HP integer rounding can force one extra blow, but
    // no early enemy is that fragile.)
    for (let hp = 5; hp <= 400; hp++) {
      const cap = earlyHitDamageCap(hp);
      expect(Math.ceil(hp / cap)).toBe(MIN_EARLY_HITS);
    }
  });

  it('never drops below 1', () => {
    expect(earlyHitDamageCap(1)).toBe(1);
    expect(earlyHitDamageCap(2)).toBe(1);
    expect(earlyHitDamageCap(0)).toBe(1);
  });

  it('matches the floor((maxHp-1)/(minHits-1)) formula on known values', () => {
    expect(earlyHitDamageCap(20)).toBe(9);   // beach skeleton
    expect(earlyHitDamageCap(24)).toBe(11);  // beach gear skeleton
    expect(earlyHitDamageCap(30, 3)).toBe(14);
  });

  it('honours a custom minHits', () => {
    // 5 hits on a 21-HP foe → floor(20/4) = 5; four blows (20) leave it alive.
    expect(earlyHitDamageCap(21, 5)).toBe(5);
    expect(5 * 4).toBeLessThan(21);
  });
});

describe('capEarlyHit', () => {
  it('clamps a big blow down on a covered floor', () => {
    expect(capEarlyHit(100, 20, 1, false)).toBe(earlyHitDamageCap(20));
    expect(capEarlyHit(100, 24, 1, true)).toBe(earlyHitDamageCap(24));
  });

  it('leaves a small blow untouched (only a cap, never a boost)', () => {
    expect(capEarlyHit(3, 20, 1, false)).toBe(3);
  });

  it('passes damage through unchanged once past the early floors', () => {
    expect(capEarlyHit(100, 20, EARLY_HIT_FLOORS + 1, false)).toBe(100);
  });
});
