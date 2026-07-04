import { describe, it, expect } from 'vitest';
import {
  VFX_PALETTES, DEFAULT_ELEMENT, SHAPE_ARCHETYPE, WEAPON_ARCHETYPE,
  BOSS_ABILITY_FX, PROJECTILE_ELEMENT, PROJECTILE_ARCHETYPES,
} from '../../src/data/vfxPalette.js';

const HEX = /^#[0-9a-f]{6}$/;
const FIELDS = ['core', 'glow', 'trail', 'spark', 'edge'];

describe('VFX_PALETTES', () => {
  it('every palette defines all five roles as valid 6-digit hex', () => {
    for (const [key, pal] of Object.entries(VFX_PALETTES)) {
      for (const f of FIELDS) {
        expect(pal[f], `${key}.${f}`).toMatch(HEX);
      }
    }
  });

  it('covers the eight spell elements plus the monster-kit roles', () => {
    for (const el of ['physical', 'fire', 'ice', 'lightning', 'holy', 'venom', 'blood', 'arcane', 'force', 'life', 'earth', 'gold']) {
      expect(VFX_PALETTES[el]).toBeTruthy();
    }
  });

  it('uses no non-ASCII characters in any hex value', () => {
    for (const pal of Object.values(VFX_PALETTES)) {
      for (const f of FIELDS) {
        // eslint-disable-next-line no-control-regex
        expect(/^[\x00-\x7F]*$/.test(pal[f])).toBe(true);
      }
    }
  });

  it('has a default element that resolves to a real palette', () => {
    expect(VFX_PALETTES[DEFAULT_ELEMENT]).toBeTruthy();
  });
});

describe('archetype tables', () => {
  it('maps all eleven cast shapes to an archetype', () => {
    for (const shape of ['self', 'melee', 'cleave', 'nova', 'bolt', 'blast', 'line', 'chain', 'teleport', 'summon', 'random']) {
      expect(typeof SHAPE_ARCHETYPE[shape]).toBe('string');
    }
    expect(Object.keys(SHAPE_ARCHETYPE)).toHaveLength(11);
  });

  it('maps every weapon style (incl. fist) to an archetype', () => {
    for (const style of ['slash', 'cleave', 'flurry', 'crush', 'thrust', 'reap', 'shot', 'bolt', 'fist']) {
      expect(typeof WEAPON_ARCHETYPE[style]).toBe('string');
    }
  });

  it('gives every boss ability a {type, el} whose el is a real palette', () => {
    for (const [ab, spec] of Object.entries(BOSS_ABILITY_FX)) {
      expect(typeof spec.type, ab).toBe('string');
      expect(VFX_PALETTES[spec.el], `${ab} -> ${spec.el}`).toBeTruthy();
    }
  });

  it('maps every projectile kind to a real palette element', () => {
    for (const [kind, el] of Object.entries(PROJECTILE_ELEMENT)) {
      expect(VFX_PALETTES[el], `${kind} -> ${el}`).toBeTruthy();
    }
  });

  it('lists only real archetypes as the deferred-hit (projectile) set', () => {
    // Every archetype whose damage lands on arrival must be one a cast shape or
    // weapon style actually resolves to — otherwise the deferral never triggers.
    const produced = new Set([...Object.values(SHAPE_ARCHETYPE), ...Object.values(WEAPON_ARCHETYPE)]);
    for (const a of PROJECTILE_ARCHETYPES) expect(produced.has(a), a).toBe(true);
    // The four traveling-bolt archetypes: bolt/blast casts, bow/staff auto-attacks.
    expect([...PROJECTILE_ARCHETYPES].sort()).toEqual(['arrow', 'blast', 'magicBolt', 'projectile']);
  });
});
