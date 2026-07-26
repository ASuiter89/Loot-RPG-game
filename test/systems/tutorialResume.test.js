import { describe, it, expect } from 'vitest';
import { savedOnShore, hasStarterGift } from '../../src/systems/tutorialResume.js';

const shoreSave = (over = {}) => ({ player: { class: 'warrior', level: 1 }, tutorial: true, inTown: false, dungeonLevel: 1, ...over });

describe('savedOnShore', () => {
  it('resumes a save taken on the beach tutorial', () => {
    expect(savedOnShore(shoreSave())).toBe(true);
  });

  // The bug this module exists for: the shore runs at dungeonLevel 1, the same
  // number as the real floor 1, so a mid-tutorial save used to boot into the
  // dungeon — skipping the starter weapon and the shore's first level-up.
  it('does not confuse a real floor-1 save with the shore', () => {
    expect(savedOnShore(shoreSave({ tutorial: false }))).toBe(false);
  });

  it('never replays the shore for a hero who already graduated', () => {
    expect(savedOnShore(shoreSave({ player: { tutorialDone: true } }))).toBe(false);
  });

  it('never sends an in-town hero back to the shore', () => {
    expect(savedOnShore(shoreSave({ inTown: true }))).toBe(false);
  });

  // Saves written before the flag shipped carry no `tutorial` field. They are all
  // past the shore (or were pushed off it by the bug), so they must read false.
  it('treats a save that predates the flag as off the shore', () => {
    expect(savedOnShore({ player: { class: 'mage', level: 7 }, dungeonLevel: 12 })).toBe(false);
    expect(savedOnShore({ player: { class: 'mage', level: 1 }, dungeonLevel: 1 })).toBe(false);
  });

  it('only accepts a real boolean flag, never a truthy leftover', () => {
    expect(savedOnShore(shoreSave({ tutorial: 1 }))).toBe(false);
    expect(savedOnShore(shoreSave({ tutorial: 'yes' }))).toBe(false);
  });

  it('refuses a missing or malformed save rather than throwing', () => {
    for (const bad of [null, undefined, {}, { player: null }, { player: 'nope', tutorial: true }]) {
      expect(savedOnShore(bad)).toBe(false);
    }
  });
});

describe('hasStarterGift', () => {
  const gift = { slot: 'weapon', name: 'Rusted Sword', tutorialGift: true };
  const plain = { slot: 'weapon', name: 'Found Sword' };

  it('is false for a hero who has not been handed one yet', () => {
    expect(hasStarterGift([], [{}, {}])).toBe(false);
    expect(hasStarterGift([plain], [{ chest: plain }, {}])).toBe(false);
  });

  it('finds the gift sitting unequipped in the bag', () => {
    expect(hasStarterGift([plain, gift], [{}, {}])).toBe(true);
  });

  // Equipping moves the gift OUT of the bag, so a bag-only check would re-gift the
  // moment the resumed shore's respawned pack is felled again.
  it('finds the gift once it has been equipped', () => {
    expect(hasStarterGift([], [{ weapon: gift }, {}])).toBe(true);
  });

  it('checks the second gear set too', () => {
    expect(hasStarterGift([], [{}, { weapon: gift }])).toBe(true);
  });

  it('tolerates missing, sparse or malformed collections', () => {
    expect(hasStarterGift(null, null)).toBe(false);
    expect(hasStarterGift(undefined, undefined)).toBe(false);
    expect(hasStarterGift([null, undefined], [null, undefined])).toBe(false);
    expect(hasStarterGift([null, gift], [null, { weapon: null }])).toBe(true);
  });
});
