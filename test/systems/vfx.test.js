import { describe, it, expect } from 'vitest';
import {
  elementOf, paletteFor, castArchetype, weaponArchetype, projectileElement, bossFxFor,
  clamp01, easeOutCubic, easeInCubic, easeInOutSine, easeOutBack, bump,
} from '../../src/systems/vfx.js';

describe('elementOf', () => {
  it('classifies spells by keyword in name', () => {
    expect(elementOf('Firebolt')).toBe('fire');
    expect(elementOf('Meteor')).toBe('fire');
    expect(elementOf('Frost Nova')).toBe('ice');
    expect(elementOf('Ice Shard')).toBe('ice');
    expect(elementOf('Chain Lightning')).toBe('lightning');
    expect(elementOf('Thunderclap')).toBe('lightning');
    expect(elementOf('Smite')).toBe('holy');
    expect(elementOf('Poison Dart')).toBe('venom');
    expect(elementOf('Venom Nova')).toBe('venom');
    expect(elementOf('Backstab')).toBe('blood');
    expect(elementOf('Throw Knife')).toBe('blood');
    expect(elementOf('Arcane Orb')).toBe('arcane');
    expect(elementOf('Blink Strike')).toBe('arcane');
  });

  it('is case-insensitive and reads the icon too', () => {
    expect(elementOf('FIREBALL')).toBe('fire');
    expect(elementOf('', 'sk_m_frostbolt')).toBe('ice');
    expect(elementOf('Whatever', 'ic_fire')).toBe('fire');
  });

  it('returns the fallback when nothing matches', () => {
    expect(elementOf('Cleave')).toBe('gold');
    expect(elementOf('Cleave', '', 'physical')).toBe('physical');
    expect(elementOf('', '')).toBe('gold');
    expect(elementOf(null, null)).toBe('gold');
  });

  it('resolves keyword priority deterministically (fire before ice)', () => {
    // "fire" pattern is checked before "ice"; a name with both keys picks fire.
    expect(elementOf('Fire and Ice')).toBe('fire');
  });
});

describe('paletteFor', () => {
  it('returns a full palette for a known element', () => {
    const p = paletteFor('fire');
    expect(p.core).toBeTruthy();
    expect(p.glow).toBeTruthy();
    expect(p.edge).toBeTruthy();
  });
  it('falls back to a real palette for an unknown element', () => {
    expect(paletteFor('nonsense')).toEqual(paletteFor('gold'));
    expect(paletteFor(undefined)).toBeTruthy();
  });
});

describe('archetype selectors', () => {
  it('castArchetype maps shapes and falls back to impact', () => {
    expect(castArchetype('bolt')).toBe('projectile');
    expect(castArchetype('nova')).toBe('nova');
    expect(castArchetype('self')).toBe('aura');
    expect(castArchetype('mystery')).toBe('impact');
  });
  it('weaponArchetype maps styles and falls back to slashArc', () => {
    expect(weaponArchetype('shot')).toBe('arrow');
    expect(weaponArchetype('bolt')).toBe('magicBolt');
    expect(weaponArchetype('crush')).toBe('smash');
    expect(weaponArchetype('unknown')).toBe('slashArc');
  });
  it('projectileElement maps kinds and falls back to physical', () => {
    expect(projectileElement('arrow')).toBe('physical');
    expect(projectileElement('fire')).toBe('fire');
    expect(projectileElement('hex')).toBe('arcane');
    expect(projectileElement('???')).toBe('physical');
  });
  it('bossFxFor returns a spec or null', () => {
    expect(bossFxFor('firewall')).toEqual({ type: 'flameLine', el: 'fire' });
    expect(bossFxFor('frost').el).toBe('ice');
    expect(bossFxFor('nope')).toBeNull();
  });
});

describe('easing helpers', () => {
  it('clamp01 clamps to [0,1]', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });
  it('cubic eases hit their endpoints and stay in range', () => {
    for (const f of [easeOutCubic, easeInCubic, easeInOutSine]) {
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const v = f(t);
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
  it('easeOutCubic is monotonic increasing', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
  it('easeOutBack overshoots above 1 before settling to 1', () => {
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    let sawOvershoot = false;
    for (let t = 0.5; t < 1; t += 0.02) if (easeOutBack(t) > 1) sawOvershoot = true;
    expect(sawOvershoot).toBe(true);
  });
  it('bump rises to 1 at the midpoint and returns to 0 at the ends', () => {
    expect(bump(0)).toBeCloseTo(0, 6);
    expect(bump(0.5)).toBeCloseTo(1, 6);
    expect(bump(1)).toBeCloseTo(0, 6);
    expect(bump(2)).toBeCloseTo(0, 6); // clamped
  });
});
