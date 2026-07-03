import { describe, it, expect } from 'vitest';
import { castLeeches, detonateIsPhysical, leechAmount } from '../../src/systems/leech.js';

describe('castLeeches', () => {
  it('leeches from weapon (physical) casts', () => {
    expect(castLeeches({ wpn: 1.5 })).toBe(true);
    // A hybrid holy strike deals weapon damage, so it leeches from that swing.
    expect(castLeeches({ wpn: 2, spell: 1 })).toBe(true);
  });

  it('does not leech from pure spell casts', () => {
    expect(castLeeches({ spell: 1.2 })).toBe(false);
    expect(castLeeches({ spell: 0, shape: 'bolt' })).toBe(false); // spell:0 is falsy wpn
  });

  it('does not leech from buff/summon/heal casts with no weapon damage', () => {
    expect(castLeeches({ shape: 'self' })).toBe(false);
    expect(castLeeches({ summon: 'wolf' })).toBe(false);
    expect(castLeeches({})).toBe(false);
  });

  it('is safe on a missing cast', () => {
    expect(castLeeches(null)).toBe(false);
    expect(castLeeches(undefined)).toBe(false);
  });
});

describe('detonateIsPhysical', () => {
  it('is physical (leechable) when the cast is not a spell cast', () => {
    expect(detonateIsPhysical({ wpn: 2, detonate: 1 })).toBe(true);
    expect(detonateIsPhysical({ detonate: 1 })).toBe(true);
  });

  it('is not physical when the cast is a spell cast — a spell-typed burst never leeches', () => {
    expect(detonateIsPhysical({ spell: 1.6, detonate: 1 })).toBe(false);
    // Hybrid: the weapon strike leeches, but the spell-typed detonate burst must not.
    expect(detonateIsPhysical({ wpn: 2, spell: 1, detonate: 1 })).toBe(false);
  });

  it('is safe on a missing cast', () => {
    expect(detonateIsPhysical(null)).toBe(true);
    expect(detonateIsPhysical(undefined)).toBe(true);
  });
});

describe('leechAmount', () => {
  it('returns a rounded share of the damage', () => {
    expect(leechAmount(100, 0.18, 999)).toBe(18);
    expect(leechAmount(50, 0.15, 999)).toBe(8); // round(7.5) => 8
  });

  it('floors at 1 when any leech is owed', () => {
    expect(leechAmount(1, 0.01, 999)).toBe(1); // round(0.01) => 0, floored to 1
  });

  it('is capped', () => {
    expect(leechAmount(1000, 0.5, 40)).toBe(40);
  });

  it('returns 0 with no damage, no fraction, or no cap', () => {
    expect(leechAmount(0, 0.5, 40)).toBe(0);
    expect(leechAmount(-5, 0.5, 40)).toBe(0);
    expect(leechAmount(100, 0, 40)).toBe(0);
    expect(leechAmount(100, 0.5, 0)).toBe(0);
  });
});
