import { describe, it, expect } from 'vitest';
import { shouldTeachFirstSpell, activeGateKind } from '../../src/systems/tutorialGates.js';

// A Guided hero mid-cast: mana just went down, nothing taught yet.
const cast = (over = {}) => ({ guided: true, taught: {}, inTown: false, mp: 6, maxMp: 20, ...over });

describe('shouldTeachFirstSpell', () => {
  it('arms on the first cast that burns mana', () => {
    expect(shouldTeachFirstSpell(cast())).toBe(true);
  });

  // The bug this module exists for: the lesson gated on `tutorialDone`, so a hero who
  // spent the beach's own skill point on an active and cast it on the sand was taught
  // nothing at all. The shore is exactly where a first cast happens.
  it('arms on the beach, where the shore hands out the first skill point', () => {
    expect(shouldTeachFirstSpell(cast({ tutorialDone: false }))).toBe(true);
  });

  it('teaches once, ever', () => {
    expect(shouldTeachFirstSpell(cast({ taught: { firstSpell: true } }))).toBe(false);
  });

  it('leaves a Classic hero alone', () => {
    expect(shouldTeachFirstSpell(cast({ guided: false }))).toBe(false);
  });

  it('never fires in town, where skills are parked', () => {
    expect(shouldTeachFirstSpell(cast({ inTown: true }))).toBe(false);
  });

  // The gate closes on a quaff, so a full pool would leave nothing to restore — and
  // no way to dismiss it.
  it('waits for a cast that actually leaves mana to refill', () => {
    expect(shouldTeachFirstSpell(cast({ mp: 20, maxMp: 20 }))).toBe(false);
  });

  // A no-mana class (Bloodletter) pays in health: no pool, no flask, no lesson.
  it('skips a hero with no mana pool at all', () => {
    expect(shouldTeachFirstSpell(cast({ mp: 0, maxMp: 0 }))).toBe(false);
  });

  it('tolerates a missing snapshot rather than throwing', () => {
    expect(shouldTeachFirstSpell()).toBe(false);
    expect(shouldTeachFirstSpell(null)).toBe(false);
  });
});

describe('activeGateKind', () => {
  it('holds no gate when nothing is pending', () => {
    expect(activeGateKind({ onShore: true })).toBe(null);
    expect(activeGateKind()).toBe(null);
  });

  it('raises the beach first-hit and equip beats in order', () => {
    expect(activeGateKind({ onShore: true, potionCueOn: true, equipCueOn: true })).toBe('potion');
    expect(activeGateKind({ onShore: true, equipCueOn: true })).toBe('equip');
  });

  it('leaves the beach cues behind once the shore is over', () => {
    expect(activeGateKind({ onShore: false, potionCueOn: true, equipCueOn: true })).toBe(null);
  });

  it('raises the mana beat off the beach and on it', () => {
    expect(activeGateKind({ manaWanted: true, mp: 3, maxMp: 20 })).toBe('mana');
    expect(activeGateKind({ onShore: true, manaWanted: true, mp: 3, maxMp: 20 })).toBe('mana');
  });

  // The keyboard stays live behind a gate, so a hero told to drink a Health Potion can
  // cast instead — the spotlight must not jump off the flask it just pointed at.
  it('lets a live beach beat finish before the mana beat opens', () => {
    const pending = { onShore: true, manaWanted: true, mp: 3, maxMp: 20 };
    expect(activeGateKind({ ...pending, potionCueOn: true })).toBe('potion');
    expect(activeGateKind({ ...pending, equipCueOn: true })).toBe('equip');
    expect(activeGateKind(pending)).toBe('mana');   // …and opens the moment it resolves
  });

  it('drops the mana beat once the pool is full again', () => {
    expect(activeGateKind({ manaWanted: true, mp: 20, maxMp: 20 })).toBe(null);
  });

  it('yields the screen to the death card', () => {
    expect(activeGateKind({ deathCardOpen: true, onShore: true, equipCueOn: true })).toBe(null);
    expect(activeGateKind({ deathCardOpen: true, manaWanted: true, mp: 3, maxMp: 20 })).toBe(null);
  });
});
