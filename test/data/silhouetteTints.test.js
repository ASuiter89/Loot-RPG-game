import { describe, it, expect } from 'vitest';
import {
  HERO_SILHOUETTE_TINT,
  HERO_SILHOUETTE_TINT_DEFAULT,
  ENEMY_SILHOUETTE_TINT,
  heroSilhouetteTint,
} from '../../src/data/silhouetteTints.js';

describe('hero silhouette tints', () => {
  it('maps each class to its requested colour (red/yellow/blue/green)', () => {
    expect(heroSilhouetteTint('warrior')).toBe(HERO_SILHOUETTE_TINT.warrior);
    expect(heroSilhouetteTint('mage')).toBe(HERO_SILHOUETTE_TINT.mage);
    expect(heroSilhouetteTint('templar')).toBe(HERO_SILHOUETTE_TINT.templar);
    expect(heroSilhouetteTint('rogue')).toBe(HERO_SILHOUETTE_TINT.rogue);
  });

  it('covers exactly the seven playable classes', () => {
    expect(Object.keys(HERO_SILHOUETTE_TINT).sort())
      .toEqual(['bloodletter', 'fortune', 'mage', 'rogue', 'templar', 'warrior', 'windblade']);
  });

  it('gives every class a DISTINCT tint, so a hidden hero always reads as itself', () => {
    const tints = Object.values(HERO_SILHOUETTE_TINT);
    expect(new Set(tints).size).toBe(tints.length);
  });

  it('falls back to the default tint for an unknown or absent class', () => {
    expect(heroSilhouetteTint(undefined)).toBe(HERO_SILHOUETTE_TINT_DEFAULT);
    expect(heroSilhouetteTint(null)).toBe(HERO_SILHOUETTE_TINT_DEFAULT);
    expect(heroSilhouetteTint('bard')).toBe(HERO_SILHOUETTE_TINT_DEFAULT);
  });
});

describe('enemy silhouette tint', () => {
  it('differs from every hero class tint so foes never blur into the Warrior', () => {
    for (const tint of Object.values(HERO_SILHOUETTE_TINT)) {
      expect(ENEMY_SILHOUETTE_TINT).not.toBe(tint);
    }
    expect(ENEMY_SILHOUETTE_TINT).not.toBe(HERO_SILHOUETTE_TINT_DEFAULT);
  });
});
