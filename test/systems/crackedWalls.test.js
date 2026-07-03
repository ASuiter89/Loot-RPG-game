import { describe, it, expect } from 'vitest';
import {
  MAX_CRACK_HITS, SMASH_COOLDOWN,
  applyCrackHit, crackStage, crackSeverity,
} from '../../src/systems/crackedWalls.js';

describe('cracked-wall tuning', () => {
  it('takes more than one shove to break', () => {
    expect(MAX_CRACK_HITS).toBeGreaterThan(1);
  });
  it('paces shoves with a positive cooldown', () => {
    expect(SMASH_COOLDOWN).toBeGreaterThan(0);
  });
});

describe('applyCrackHit', () => {
  it('counts up one blow at a time', () => {
    expect(applyCrackHit(0).hits).toBe(1);
    expect(applyCrackHit(1).hits).toBe(2);
  });

  it('does not break until the final blow', () => {
    expect(applyCrackHit(0, 3).broken).toBe(false);
    expect(applyCrackHit(1, 3).broken).toBe(false);
    expect(applyCrackHit(2, 3).broken).toBe(true);
  });

  it('breaks on the very first blow when one hit is enough', () => {
    expect(applyCrackHit(0, 1)).toEqual({ hits: 1, broken: true });
  });

  it('treats negative/garbage prior hits as zero', () => {
    expect(applyCrackHit(-5).hits).toBe(1);
    expect(applyCrackHit(undefined).hits).toBe(1);
    expect(applyCrackHit(NaN).hits).toBe(1);
  });

  it('floors a fractional prior count before adding', () => {
    expect(applyCrackHit(1.9).hits).toBe(2);
  });

  it('defaults to MAX_CRACK_HITS breaking the wall', () => {
    expect(applyCrackHit(MAX_CRACK_HITS - 1).broken).toBe(true);
    expect(applyCrackHit(MAX_CRACK_HITS - 2).broken).toBe(false);
  });
});

describe('crackStage', () => {
  it('is 0 for a fresh, untouched crack', () => {
    expect(crackStage(0, 3)).toBe(0);
  });

  it('rises with damage but never reaches maxHits', () => {
    expect(crackStage(1, 3)).toBe(1);
    expect(crackStage(2, 3)).toBe(2);
    expect(crackStage(3, 3)).toBe(2); // clamped — a wall this damaged has collapsed
    expect(crackStage(99, 3)).toBe(2);
  });

  it('clamps negative hits to 0', () => {
    expect(crackStage(-3, 3)).toBe(0);
  });
});

describe('crackSeverity', () => {
  it('runs 0 (fresh) to 1 (about to give)', () => {
    expect(crackSeverity(0, 3)).toBe(0);
    expect(crackSeverity(1, 3)).toBeCloseTo(0.5);
    expect(crackSeverity(2, 3)).toBe(1);
  });

  it('never exceeds 1 no matter the hit count', () => {
    expect(crackSeverity(50, 3)).toBe(1);
  });

  it('is 0 when a single hit breaks the wall (no visible stages)', () => {
    expect(crackSeverity(0, 1)).toBe(0);
    expect(crackSeverity(5, 1)).toBe(0);
  });
});
