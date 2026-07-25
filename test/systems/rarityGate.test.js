import { describe, it, expect } from 'vitest';
import {
  GREEN_BOSS_FLOOR, BLUE_BOSS_FLOOR,
  bossDefeated, greensUnlocked, bluesUnlocked, lockedTiers,
  RARITY_LADDER, tiersAboveFound,
} from '../../src/systems/rarityGate.js';

describe('rarity gate — boss floors', () => {
  it('greens unlock on floor 5, blues on floor 10', () => {
    expect(GREEN_BOSS_FLOOR).toBe(5);
    expect(BLUE_BOSS_FLOOR).toBe(10);
  });
});

describe('bossDefeated', () => {
  it('is true once the boss floor is in the first-kill ledger', () => {
    expect(bossDefeated(5, { '5': 1 }, 5)).toBe(true);
  });

  it('reads the ledger by STRING key (matches bossFloorKey)', () => {
    // The ledger is keyed by the floor number as a string; a numeric floor arg
    // must still hit it.
    expect(bossDefeated(5, { '5': 1 }, 1)).toBe(true);
  });

  it('is true when the deepest floor reached is PAST the boss floor', () => {
    // You cannot pass a boss floor without clearing it — covers pre-ledger saves.
    expect(bossDefeated(5, {}, 6)).toBe(true);
    expect(bossDefeated(5, null, 6)).toBe(true);
  });

  it('is false with no ledger entry and not yet past the floor', () => {
    expect(bossDefeated(5, {}, 5)).toBe(false);
    expect(bossDefeated(5, {}, 1)).toBe(false);
    expect(bossDefeated(10, { '5': 1 }, 6)).toBe(false);
  });

  it('treats a missing/garbage maxFloor as floor 1', () => {
    expect(bossDefeated(5, {}, undefined)).toBe(false);
    expect(bossDefeated(5, {}, NaN)).toBe(false);
    expect(bossDefeated(5, {}, 0)).toBe(false);
  });
});

describe('greensUnlocked / bluesUnlocked', () => {
  it('gate on their respective boss floors', () => {
    expect(greensUnlocked({}, 1)).toBe(false);
    expect(greensUnlocked({ '5': 1 }, 1)).toBe(true);
    expect(bluesUnlocked({ '5': 1 }, 6)).toBe(false);
    expect(bluesUnlocked({ '10': 1 }, 1)).toBe(true);
    expect(bluesUnlocked({}, 11)).toBe(true);
  });
});

describe('lockedTiers', () => {
  it('locks every coloured tier before the first boss', () => {
    const locked = lockedTiers({}, 1);
    for (const t of ['uncommon', 'rare', 'epic', 'legendary', 'unique']) {
      expect(locked.has(t)).toBe(true);
    }
    // greys/whites are never gated.
    expect(locked.has('junk')).toBe(false);
    expect(locked.has('normal')).toBe(false);
  });

  it('opens greens only after the floor-5 boss, keeping blue+ locked', () => {
    const locked = lockedTiers({ '5': 1 }, 5);
    expect(locked.has('uncommon')).toBe(false);
    for (const t of ['rare', 'epic', 'legendary', 'unique']) {
      expect(locked.has(t)).toBe(true);
    }
  });

  it('opens every tier once the floor-10 boss is beaten', () => {
    const locked = lockedTiers({ '5': 1, '10': 1 }, 10);
    expect(locked.size).toBe(0);
  });

  it('a deep save (high maxFloor) has nothing locked even with an empty ledger', () => {
    expect(lockedTiers({}, 40).size).toBe(0);
  });
});

describe('tiersAboveFound — cap the merchant at what the hero has FOUND', () => {
  it('ranks the ladder junk 0 · white 1 · green 2 · blue 3 · purple 4 · orange 5 · red 6', () => {
    expect(RARITY_LADDER).toEqual(
      ['junk', 'normal', 'uncommon', 'rare', 'epic', 'legendary', 'unique']);
  });

  it('never found a blue → blue and every rarer tier are withheld', () => {
    // Highest found is green (rank 2): blue (3) and up must be locked.
    const locked = tiersAboveFound(2);
    for (const t of ['rare', 'epic', 'legendary', 'unique']) expect(locked.has(t)).toBe(true);
    // What you HAVE found (and below) is still sellable.
    for (const t of ['junk', 'normal', 'uncommon']) expect(locked.has(t)).toBe(false);
  });

  it('found a purple → purple and below open, orange/red still capped', () => {
    const locked = tiersAboveFound(4); // epic (purple) is the highest found
    for (const t of ['junk', 'normal', 'uncommon', 'rare', 'epic']) expect(locked.has(t)).toBe(false);
    for (const t of ['legendary', 'unique']) expect(locked.has(t)).toBe(true);
  });

  it('a fresh hero (only white found) is capped to white — no colour at all', () => {
    const locked = tiersAboveFound(1); // normal (white)
    for (const t of ['uncommon', 'rare', 'epic', 'legendary', 'unique']) expect(locked.has(t)).toBe(true);
    expect(locked.has('junk')).toBe(false);
    expect(locked.has('normal')).toBe(false);
  });

  it('a red found (top rank) caps nothing', () => {
    expect(tiersAboveFound(6).size).toBe(0);
  });

  it('a non-finite rank means NO cap (backward-compatible default)', () => {
    for (const bad of [undefined, null, NaN, 'x']) expect(tiersAboveFound(bad).size).toBe(0);
  });
});
