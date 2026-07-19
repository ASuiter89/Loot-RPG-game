import { describe, it, expect } from 'vitest';
import { rollHoardRoomCount } from '../../src/systems/hoardRooms.js';
import { HOARD_ROOM } from '../../src/data/hoardRooms.js';

// A hoard room is a rare jackpot: most floors get none, a lucky few get one, and
// rarer still a floor gets two. These lock the count contract (0/1/2), the roll
// order (the appearance gate is checked before the second-room promotion), and that
// the shipped default tuning stays firmly in "rare" territory.

// Deterministic rng: hands back queued values in order, then 0 once drained.
const seq = (...vals) => { let i = 0; return () => (i < vals.length ? vals[i++] : 0); };

describe('rollHoardRoomCount', () => {
  it('returns 0 when the appearance roll misses (the common case)', () => {
    // First roll ≥ chance → no room, and the second roll is never consulted.
    expect(rollHoardRoomCount(seq(0.5), { chance: 0.001, secondChance: 0.5 })).toBe(0);
    expect(rollHoardRoomCount(seq(0.001), { chance: 0.001, secondChance: 1 })).toBe(0); // boundary: >= misses
  });

  it('returns 1 when a room appears but the second-room roll misses', () => {
    expect(rollHoardRoomCount(seq(0.0005, 0.9), { chance: 0.001, secondChance: 0.2 })).toBe(1);
    expect(rollHoardRoomCount(seq(0.0005, 0.2), { chance: 0.001, secondChance: 0.2 })).toBe(1); // boundary: >= misses
  });

  it('returns 2 only when both the appearance and second-room rolls hit', () => {
    expect(rollHoardRoomCount(seq(0.0005, 0.1), { chance: 0.001, secondChance: 0.2 })).toBe(2);
  });

  it('never promotes to a second room when none appears (order matters)', () => {
    // Even with a second value deep in the "second room" range, a missed first roll
    // yields 0 — the second roll must not be able to conjure a room on its own.
    expect(rollHoardRoomCount(seq(0.99, 0.0), { chance: 0.001, secondChance: 1 })).toBe(0);
  });

  it('honors extreme tuning: always-off and always-two', () => {
    expect(rollHoardRoomCount(seq(0), { chance: 0, secondChance: 1 })).toBe(0);   // chance 0 → never appears
    expect(rollHoardRoomCount(seq(0, 0), { chance: 1, secondChance: 1 })).toBe(2); // both certain → two
    expect(rollHoardRoomCount(seq(0, 0.5), { chance: 1, secondChance: 0 })).toBe(1); // certain room, never doubled
  });

  it('falls back to the shipped tuning and always yields a valid count', () => {
    for (const r of [0, 0.00005, 0.3, 0.9999]) {
      const n = rollHoardRoomCount(() => r);
      expect([0, 1, 2]).toContain(n);
    }
  });

  it('ships a rare default that still allows the occasional double', () => {
    expect(HOARD_ROOM.chance).toBeGreaterThan(0);
    expect(HOARD_ROOM.chance).toBeLessThan(0.01);       // firmly rare
    expect(HOARD_ROOM.secondChance).toBeGreaterThan(0);  // doubles are possible
    expect(HOARD_ROOM.secondChance).toBeLessThan(1);     // but not the norm
  });
});
