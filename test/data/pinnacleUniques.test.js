import { describe, it, expect } from 'vitest';
import {
  PINNACLE_UNIQUES,
  pinnacleUniqueById,
  allPinnacleUniqueIds,
} from '../../src/data/pinnacleUniques.js';

// Valid attribute + stat identifiers (mirrors the live game's ATTRS/stat tables).
const ATTRS = new Set(['might', 'agility', 'spirit', 'luck', 'vitality']);
// Caster-only vs martial-only stats that must never mix on a single piece.
const CASTER_STATS = new Set(['SPELLPWR', 'CASTSPD']);
const MARTIAL_STATS = new Set(['SKILLPWR', 'ATKSPD']);

describe('PINNACLE_UNIQUES shape', () => {
  it('has a healthy authored roster (6–10 Mythics)', () => {
    expect(Array.isArray(PINNACLE_UNIQUES)).toBe(true);
    expect(PINNACLE_UNIQUES.length).toBeGreaterThanOrEqual(6);
    expect(PINNACLE_UNIQUES.length).toBeLessThanOrEqual(10);
  });

  it('every entry has the full uniques.js field set + mythic marker', () => {
    for (const u of PINNACLE_UNIQUES) {
      expect(typeof u.id).toBe('string');
      expect(typeof u.base).toBe('string');
      expect(typeof u.slot).toBe('string');
      expect(typeof u.name).toBe('string');
      expect(typeof u.cls).toBe('string');
      expect(typeof u.native).toBe('string');
      expect(typeof u.power).toBe('string');
      expect(typeof u.flavor).toBe('string');
      expect(u.mythic).toBe(true);
    }
  });

  it('carries exactly 2 distinct signature powers, primary mirrored to `power`', () => {
    // Lane-locked powers are dead on the wrong family (see uniques.js), so a caster
    // Mythic never carries martial powers and vice versa.
    const MARTIAL_POWERS = new Set(['warmage', 'frenzied']);
    const CASTER_POWERS = new Set(['spellbound', 'quickened']);
    for (const u of PINNACLE_UNIQUES) {
      expect(Array.isArray(u.powers)).toBe(true);
      expect(u.powers.length).toBe(2); // primary + rollable secondary
      expect(new Set(u.powers).size).toBe(u.powers.length); // distinct
      for (const p of u.powers) expect(typeof p).toBe('string');
      expect(u.power).toBe(u.powers[0]); // primary mirrored
      const isCaster = [...u.mods.map((m) => m.key), u.native].some((k) => CASTER_STATS.has(k));
      for (const p of u.powers) {
        if (isCaster) expect(MARTIAL_POWERS.has(p)).toBe(false);
        else expect(CASTER_POWERS.has(p)).toBe(false);
      }
    }
  });

  it('every entry carries EXACTLY six mods: five stats + one attribute', () => {
    for (const u of PINNACLE_UNIQUES) {
      expect(Array.isArray(u.mods)).toBe(true);
      expect(u.mods).toHaveLength(6);
      const stats = u.mods.filter((m) => m.kind === 'stat');
      const attrs = u.mods.filter((m) => m.kind === 'attr');
      expect(stats).toHaveLength(5);
      expect(attrs).toHaveLength(1);
      // The single attr mod must be a real attribute.
      expect(ATTRS.has(attrs[0].key)).toBe(true);
    }
  });

  it('mods are all distinct and none equals the native stat', () => {
    for (const u of PINNACLE_UNIQUES) {
      const keys = u.mods.map((m) => m.key);
      expect(new Set(keys).size).toBe(keys.length); // distinct
      expect(keys).not.toContain(u.native);         // never the native
    }
  });

  it('never a raw DMG headline on a weapon mod or native', () => {
    for (const u of PINNACLE_UNIQUES) {
      expect(u.native).not.toBe('DMG');
      for (const m of u.mods) expect(m.key).not.toBe('DMG');
    }
  });

  it('caster and martial stat families never mix on one piece', () => {
    for (const u of PINNACLE_UNIQUES) {
      const keys = new Set([u.native, ...u.mods.map((m) => m.key)]);
      const hasCaster = [...keys].some((k) => CASTER_STATS.has(k));
      const hasMartial = [...keys].some((k) => MARTIAL_STATS.has(k));
      expect(hasCaster && hasMartial).toBe(false);
    }
  });

  it('flavor references no other game/franchise (player-facing copy)', () => {
    const banned = /diablo|golden sun|roguelike|zelda|pokemon|final fantasy|dark souls|elden/i;
    for (const u of PINNACLE_UNIQUES) {
      expect(banned.test(u.flavor)).toBe(false);
    }
  });

  it('ids are unique across the roster', () => {
    const ids = PINNACLE_UNIQUES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('entries are frozen (immutable data)', () => {
    for (const u of PINNACLE_UNIQUES) expect(Object.isFrozen(u)).toBe(true);
  });
});

describe('pinnacleUniqueById', () => {
  it('returns the matching entry', () => {
    const first = PINNACLE_UNIQUES[0];
    expect(pinnacleUniqueById(first.id)).toBe(first);
  });
  it('returns null for unknown / garbage ids', () => {
    expect(pinnacleUniqueById('nope')).toBe(null);
    expect(pinnacleUniqueById(undefined)).toBe(null);
    expect(pinnacleUniqueById(null)).toBe(null);
  });
});

describe('allPinnacleUniqueIds', () => {
  it('lists every id once', () => {
    const ids = allPinnacleUniqueIds();
    expect(ids).toHaveLength(PINNACLE_UNIQUES.length);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
