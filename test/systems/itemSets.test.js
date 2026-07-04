import { describe, it, expect } from 'vitest';
import {
  setPieceCount, setTopTier, setComplete, setStatContribution,
  setSlots, setPiecePool, rollSetPiece, setsCoverAllSlots,
} from '../../src/systems/itemSets.js';
import { ITEM_SETS } from '../../src/data/itemSets.js';

// Mirrors SLOT_KEYS (Object.keys(SLOTS)) in src/legacy/game.js.
const SLOT_KEYS = ['weapon', 'offhand', 'head', 'chest', 'hands', 'legs', 'ring', 'amulet'];

// A tiny synthetic set for edge cases independent of the shipped roster.
const SYN = {
  pieces: [{ slot: 'weapon' }, { slot: 'ring' }],
  bonus: { 2: { ATK: 5, CRIT: 3 } },
  power: { name: 'Test', stats: { LEECH: 4 }, desc: '' },
};

describe('setPieceCount', () => {
  it('is the number of pieces (= slots) the set covers', () => {
    expect(setPieceCount(ITEM_SETS.prospector)).toBe(2);
    expect(setPieceCount(ITEM_SETS.reaver)).toBe(3);
    expect(setPieceCount(ITEM_SETS.arcanist)).toBe(4);
    expect(setPieceCount(ITEM_SETS.warden)).toBe(5);
    expect(setPieceCount(ITEM_SETS.stalker)).toBe(6);
  });
  it('is 0 for a missing or pieceless set', () => {
    expect(setPieceCount(null)).toBe(0);
    expect(setPieceCount(undefined)).toBe(0);
    expect(setPieceCount({})).toBe(0);
  });
});

describe('setTopTier', () => {
  it('is the highest bonus threshold the set defines', () => {
    expect(setTopTier(ITEM_SETS.prospector)).toBe(2);
    expect(setTopTier(ITEM_SETS.stalker)).toBe(6);
    expect(setTopTier(SYN)).toBe(2);
  });
  it('is 0 for a set with no bonus table', () => {
    expect(setTopTier(null)).toBe(0);
    expect(setTopTier({})).toBe(0);
  });
});

describe('setComplete', () => {
  it('needs every piece worn', () => {
    expect(setComplete(ITEM_SETS.reaver, 2)).toBe(false);
    expect(setComplete(ITEM_SETS.reaver, 3)).toBe(true);
    expect(setComplete(ITEM_SETS.reaver, 4)).toBe(true); // can't exceed, but stays complete
  });
  it('completes a 2-piece set at 2 and a 6-piece set only at 6', () => {
    expect(setComplete(ITEM_SETS.prospector, 1)).toBe(false);
    expect(setComplete(ITEM_SETS.prospector, 2)).toBe(true);
    expect(setComplete(ITEM_SETS.stalker, 5)).toBe(false);
    expect(setComplete(ITEM_SETS.stalker, 6)).toBe(true);
  });
  it('is false for a missing set', () => {
    expect(setComplete(null, 9)).toBe(false);
  });
});

describe('setStatContribution', () => {
  it('sums every met bonus tier for a stat', () => {
    // reaver ATK: tier2 (12) only at n=2; tier2+tier3 (12+30) at n=3.
    expect(setStatContribution(ITEM_SETS.reaver, 1, 'ATK')).toBe(0);
    expect(setStatContribution(ITEM_SETS.reaver, 2, 'ATK')).toBe(12);
    expect(setStatContribution(ITEM_SETS.reaver, 3, 'ATK')).toBe(12 + 30);
  });
  it('adds the completion power only once the set is complete', () => {
    // reaver LEECH lives only on the completion power (complete at 3 pieces).
    expect(setStatContribution(ITEM_SETS.reaver, 2, 'LEECH')).toBe(0);
    expect(setStatContribution(ITEM_SETS.reaver, 3, 'LEECH')).toBe(8);
  });
  it('folds bonus + completion power for a stat in both', () => {
    // prospector GOLDFIND: 30 from the 2-piece tier + 40 from the now-active power.
    expect(setStatContribution(ITEM_SETS.prospector, 2, 'GOLDFIND')).toBe(70);
    // MATFIND only exists on the completion power.
    expect(setStatContribution(ITEM_SETS.prospector, 2, 'MATFIND')).toBe(25);
  });
  it('returns 0 for an unrelated stat, or a missing/bonusless set', () => {
    expect(setStatContribution(ITEM_SETS.reaver, 3, 'MP')).toBe(0);
    expect(setStatContribution(null, 3, 'ATK')).toBe(0);
    expect(setStatContribution({}, 3, 'ATK')).toBe(0);
  });
  it('handles a set whose completion power carries no stats', () => {
    const noStatPower = { pieces: [{ slot: 'ring' }], bonus: { 1: { LCK: 2 } }, power: { name: 'x', desc: '' } };
    expect(setStatContribution(noStatPower, 1, 'LCK')).toBe(2);
  });
});

describe('setSlots', () => {
  it('lists the slot of each piece', () => {
    expect(setSlots(ITEM_SETS.prospector).sort()).toEqual(['amulet', 'ring']);
    expect(setSlots(SYN)).toEqual(['weapon', 'ring']);
    expect(setSlots(null)).toEqual([]);
  });
});

describe('setPiecePool', () => {
  it('flattens every piece as { setId, piece }', () => {
    const pool = setPiecePool(ITEM_SETS);
    const total = Object.values(ITEM_SETS).reduce((n, s) => n + s.pieces.length, 0);
    expect(pool.length).toBe(total);
    for (const sp of pool) {
      expect(typeof sp.setId).toBe('string');
      expect(ITEM_SETS[sp.setId]).toBeTruthy();
      expect(sp.piece.slot).toBeTruthy();
      expect(ITEM_SETS[sp.setId].pieces).toContain(sp.piece);
    }
  });
});

describe('rollSetPiece', () => {
  it('with a slot, only returns a piece of that slot', () => {
    for (const slot of SLOT_KEYS) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        const sp = rollSetPiece(slot, () => r, ITEM_SETS);
        expect(sp, `no set piece for slot ${slot}`).not.toBeNull();
        expect(sp.piece.slot).toBe(slot);
        expect(ITEM_SETS[sp.setId]).toBeTruthy();
      }
    }
  });
  it('with no slot, draws from the whole pool (deterministic across rng)', () => {
    const pool = setPiecePool(ITEM_SETS);
    expect(rollSetPiece(null, () => 0, ITEM_SETS).piece).toBe(pool[0].piece);
    expect(rollSetPiece(null, () => 0.999, ITEM_SETS).piece).toBe(pool[pool.length - 1].piece);
  });
  it('returns null when no set piece covers the slot', () => {
    expect(rollSetPiece('trinket', () => 0.5, ITEM_SETS)).toBeNull();
    expect(rollSetPiece('weapon', () => 0, { none: { pieces: [{ slot: 'ring' }] } })).toBeNull();
  });
});

describe('setsCoverAllSlots', () => {
  it('the shipped roster covers every equipment slot', () => {
    expect(setsCoverAllSlots(SLOT_KEYS, ITEM_SETS)).toBe(true);
  });
  it('is false when a slot no set fills is required', () => {
    expect(setsCoverAllSlots([...SLOT_KEYS, 'wings'], ITEM_SETS)).toBe(false);
    expect(setsCoverAllSlots(['legs'], { onlyRings: { pieces: [{ slot: 'ring' }] } })).toBe(false);
  });
});
