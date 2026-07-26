import { describe, it, expect } from 'vitest';
import {
  seasonAffixDef, seasonAtkSpeedMult, seasonArmorAdd, seasonBurstRadius, seasonBurstDamage,
} from '../../src/systems/seasonAffix.js';
import { SEASON_AFFIXES } from '../../src/data/seasonAffixes.js';
import { CYCLE_MODIFIERS } from '../../src/data/cycleModifiers.js';

describe('SEASON_AFFIXES data', () => {
  it('covers every enemyAffix any cycle headline rule names', () => {
    // The bug this pins: a rule can only be APPLIED if the shell can resolve its
    // affix key. An unresolvable key silently means "the season does nothing".
    for (const m of CYCLE_MODIFIERS) {
      const key = m.params && m.params.enemyAffix;
      if (!key) continue;
      expect(SEASON_AFFIXES[key], `${m.id} names enemyAffix "${key}"`).toBeTruthy();
    }
  });

  it('gives every affix a name, a colour and a player-facing blurb', () => {
    for (const [key, def] of Object.entries(SEASON_AFFIXES)) {
      expect(typeof def.name, key).toBe('string');
      expect(def.color, key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof def.blurb, key).toBe('string');
    }
  });

  it('is pressure, never a wall — every knob stays in a survivable band', () => {
    for (const [key, def] of Object.entries(SEASON_AFFIXES)) {
      if (def.atkSpeedMult != null) {
        expect(def.atkSpeedMult, key).toBeGreaterThan(1);
        expect(def.atkSpeedMult, key).toBeLessThanOrEqual(1.5);
      }
      if (def.armorAdd != null) {
        expect(def.armorAdd, key).toBeGreaterThan(0);
        expect(def.armorAdd, key).toBeLessThanOrEqual(0.15);
      }
      if (def.burstRadius != null) {
        expect(def.burstCapFrac, key).toBeGreaterThan(0);
        expect(def.burstCapFrac, key).toBeLessThanOrEqual(0.25); // never a one-shot
      }
    }
  });
});

describe('season affix resolvers', () => {
  it('resolve an unknown / absent key to the neutral value', () => {
    for (const key of [null, undefined, '', 'nonesuch']) {
      expect(seasonAffixDef(key)).toBe(null);
      expect(seasonAtkSpeedMult(key)).toBe(1);
      expect(seasonArmorAdd(key)).toBe(0);
      expect(seasonBurstRadius(key)).toBe(0);
      expect(seasonBurstDamage(key, 100, 1000)).toBe(0);
    }
  });

  it('read the live knobs for a known key', () => {
    expect(seasonAffixDef('frenzied').name).toBe('Frenzied');
    expect(seasonAtkSpeedMult('frenzied')).toBe(SEASON_AFFIXES.frenzied.atkSpeedMult);
    expect(seasonArmorAdd('armored')).toBe(SEASON_AFFIXES.armored.armorAdd);
    expect(seasonBurstRadius('volatile')).toBe(SEASON_AFFIXES.volatile.burstRadius);
  });

  it('leave the other knobs neutral for an affix that does not set them', () => {
    expect(seasonAtkSpeedMult('armored')).toBe(1);
    expect(seasonArmorAdd('frenzied')).toBe(0);
    expect(seasonBurstRadius('frenzied')).toBe(0);
  });

  it('clamp a garbage tuning value instead of trusting it', () => {
    const bad = { boom: { atkSpeedMult: 99, armorAdd: 9, burstRadius: 2, burstDmgFrac: 5, burstCapFrac: 9 } };
    expect(seasonAtkSpeedMult('boom', bad)).toBe(99);   // fast is allowed…
    expect(seasonArmorAdd('boom', bad)).toBe(0.5);      // …but armor can never wall you out
    const dmg = seasonBurstDamage('boom', 100, 1000, bad);
    expect(dmg).toBeLessThanOrEqual(1000);
  });
});

describe('seasonBurstDamage — a corpse can hurt, never one-shot', () => {
  it('is a share of the foe\'s own hit', () => {
    const f = SEASON_AFFIXES.volatile.burstDmgFrac;
    expect(seasonBurstDamage('volatile', 50, 100000)).toBe(Math.round(50 * f));
  });

  it('caps at a share of the hero\'s max HP however hard the foe hits', () => {
    const cap = Math.round(1000 * SEASON_AFFIXES.volatile.burstCapFrac);
    expect(seasonBurstDamage('volatile', 99999, 1000)).toBe(cap);
    expect(seasonBurstDamage('volatile', 99999, 1000)).toBeLessThan(1000);
  });

  it('is 0 for a harmless foe and never negative', () => {
    expect(seasonBurstDamage('volatile', 0, 1000)).toBe(0);
    expect(seasonBurstDamage('volatile', -50, 1000)).toBe(0);
    expect(seasonBurstDamage('volatile', NaN, 1000)).toBe(0);
  });
});
