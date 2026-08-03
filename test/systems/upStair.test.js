import { describe, it, expect } from 'vitest';
import { upStairPlaced } from '../../src/systems/upStair.js';

describe('upStairPlaced', () => {
  // The bug this module exists for: a brand-new hero walks out of the beach cave and
  // spawns standing on floor 1's red gate — which, until the Floor-5 guardian falls,
  // can only refuse them. It reads like a way back to the shore and does nothing.
  it('withholds floor 1s gate while there is no town behind it', () => {
    expect(upStairPlaced({ displayFloor: 1, townUnlocked: false })).toBe(false);
  });

  it('lays floor 1s gate once the town is open', () => {
    expect(upStairPlaced({ displayFloor: 1, townUnlocked: true })).toBe(true);
  });

  // Floors 2+ climb to a floor that definitely exists, town or no town.
  it('always lays a real staircase on deeper floors', () => {
    for (const f of [2, 3, 5, 24, 25]) {
      expect(upStairPlaced({ displayFloor: f, townUnlocked: false })).toBe(true);
    }
  });

  // displayFloor is the number WITHIN a difficulty, so a later tier's floor 1 is the
  // same case — and by then the town is long since open, so the gate stands.
  it('treats a later difficulty\'s floor 1 as a floor 1', () => {
    expect(upStairPlaced({ displayFloor: 1, townUnlocked: true })).toBe(true);
    expect(upStairPlaced({ displayFloor: 1, townUnlocked: false })).toBe(false);
  });

  it('reads a garbage floor as "not floor 1" rather than hiding a real staircase', () => {
    expect(upStairPlaced({ displayFloor: NaN, townUnlocked: false })).toBe(true);
    expect(upStairPlaced({})).toBe(true);
    expect(upStairPlaced(null)).toBe(true);
  });

  it('floors a fractional depth onto its own floor number', () => {
    expect(upStairPlaced({ displayFloor: 1.9, townUnlocked: false })).toBe(false);
  });
});
