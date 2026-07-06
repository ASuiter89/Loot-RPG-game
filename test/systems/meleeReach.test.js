import { describe, it, expect } from 'vitest';
import { footprintReach, inWeaponReach } from '../../src/systems/meleeReach.js';
import { MELEE_REACH_BONUS } from '../../src/data/combatReach.js';

// (px, py) is the hero body centre; (efx, efy) is the foe's smooth footprint centre —
// both in tile units where a tile-centred sprite reads x + 0.5.

describe('footprintReach', () => {
  it('reads ~1.0 for a sprite one tile to the side', () => {
    // hero at (5.5, 5.5); foe sprite one tile right at (6.5, 5.5)
    expect(footprintReach(5.5, 5.5, 6.5, 5.5, 1)).toBeCloseTo(1.0, 6);
  });

  it('reads ~1.0 for a diagonal neighbour (Chebyshev, not Euclidean)', () => {
    expect(footprintReach(5.5, 5.5, 6.5, 6.5, 1)).toBeCloseTo(1.0, 6);
  });

  it('reads ~2.0 for a sprite one clear tile away', () => {
    expect(footprintReach(5.5, 5.5, 7.5, 5.5, 1)).toBeCloseTo(2.0, 6);
  });

  it('tracks the smooth sprite, not a logic tile — a foe drifted close reads close', () => {
    // A fleeing foe whose logic tile is 2 away (centre 7.5) but whose sprite lagged
    // back to 6.4: the hero should read it as ~0.9 away, not 2.0.
    expect(footprintReach(5.5, 5.5, 6.4, 5.5, 1)).toBeCloseTo(0.9, 6);
  });

  it('treats a missing size as a single tile', () => {
    // size omitted → falls back to 1, same as an explicit size-1 foe
    expect(footprintReach(5.5, 5.5, 6.5, 5.5)).toBeCloseTo(footprintReach(5.5, 5.5, 6.5, 5.5, 1), 6);
  });

  it('uses the NEAREST cell of a multi-tile foe', () => {
    // 2×2 boss whose footprint centre sits at (9, 9): its cell centres are (8.5/9.5)²,
    // so the nearest to a hero at (6.5, 9.5) is (8.5, 9.5) → Chebyshev 2.0.
    expect(footprintReach(6.5, 9.5, 9, 9, 2)).toBeCloseTo(2.0, 6);
  });
});

describe('inWeaponReach with the half-tile bonus', () => {
  const R = 1; // a plain melee weapon reaches 1 tile

  it('still connects on a sprite that is right up against the hero', () => {
    // aggro foes rest ~0.72 tiles from the hero — comfortably in reach
    expect(inWeaponReach(5.5, 5.5, 6.2, 5.5, 1, R, MELEE_REACH_BONUS)).toBe(true);
  });

  it('connects across up to a half-tile gap — the whole point of the change', () => {
    // sprite centre 1.5 tiles away (about half a tile of visible gap): now a hit…
    expect(inWeaponReach(5.5, 5.5, 7.0, 5.5, 1, R, MELEE_REACH_BONUS)).toBe(true);
    // …whereas without the bonus that same foe is out of reach
    expect(inWeaponReach(5.5, 5.5, 7.0, 5.5, 1, R)).toBe(false);
  });

  it('does NOT reach a foe more than a half tile past the weapon range', () => {
    // sprite centre 1.6 tiles away → beyond 1 + 0.5
    expect(inWeaponReach(5.5, 5.5, 7.1, 5.5, 1, R, MELEE_REACH_BONUS)).toBe(false);
  });

  it('scales with the weapon range — a reach-2 spear connects at 2.5 tiles', () => {
    expect(inWeaponReach(5.5, 5.5, 8.0, 5.5, 1, 2, MELEE_REACH_BONUS)).toBe(true);   // 2.5
    expect(inWeaponReach(5.5, 5.5, 8.1, 5.5, 1, 2, MELEE_REACH_BONUS)).toBe(false);  // 2.6
  });

  it('the raw reach (bonus 0) is the plain range when both are tile-centred', () => {
    expect(inWeaponReach(5.5, 5.5, 6.5, 5.5, 1, R)).toBe(true);   // adjacent
    expect(inWeaponReach(5.5, 5.5, 7.5, 5.5, 1, R)).toBe(false);  // one clear tile away
  });
});
