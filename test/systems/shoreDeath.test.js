import { describe, it, expect } from 'vitest';
import { deathRoute } from '../../src/systems/shoreDeath.js';

describe('deathRoute', () => {
  it('sends an ordinary dungeon death to town', () => {
    expect(deathRoute({})).toBe('town');
    expect(deathRoute({ tutorialActive: false, inTown: false })).toBe('town');
  });

  // The bug this module exists for: a beach death used to revive in town, and a
  // town save never comes back to the shore — so the tutorial, the starter weapon
  // and the shore's first level-up were all skipped by one stumble.
  it('keeps a death on the beach tutorial on the shore', () => {
    expect(deathRoute({ tutorialActive: true })).toBe('shore');
  });

  it('spends the free Last Stand before anything else', () => {
    expect(deathRoute({ lastStandReady: true, tutorialActive: true })).toBe('laststand');
    expect(deathRoute({ lastStandReady: true, hardcore: true })).toBe('laststand');
    expect(deathRoute({ lastStandReady: true, reviveBuff: true })).toBe('laststand');
  });

  it('burns a revive bowl before the death itself lands', () => {
    expect(deathRoute({ reviveBuff: true })).toBe('revive');
    expect(deathRoute({ reviveBuff: true, hardcore: true })).toBe('revive');
    expect(deathRoute({ reviveBuff: true, tutorialActive: true })).toBe('revive');
  });

  // Hardcore is one life, tutorial included — the shore retry must not become a
  // back door around permadeath.
  it('still ends a hardcore hero, even on the shore', () => {
    expect(deathRoute({ hardcore: true })).toBe('permadeath');
    expect(deathRoute({ hardcore: true, tutorialActive: true })).toBe('permadeath');
  });

  it('never routes an in-town death onto a shore that is not there', () => {
    expect(deathRoute({ tutorialActive: true, inTown: true })).toBe('town');
  });

  it('tolerates a missing snapshot rather than throwing', () => {
    expect(deathRoute()).toBe('town');
    expect(deathRoute(null)).toBe('town');
  });
});
