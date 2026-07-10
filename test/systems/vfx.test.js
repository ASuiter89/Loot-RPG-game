import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  elementOf, paletteFor, castArchetype, weaponArchetype, projectileElement, bossFxFor,
  archetypeIsProjectile, hashStr, castSignature,
  clamp01, easeOutCubic, easeInCubic, easeInOutSine, easeOutBack, bump,
} from '../../src/systems/vfx.js';
import { SIGIL_GLYPHS } from '../../src/data/vfxPalette.js';

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

describe('archetypeIsProjectile', () => {
  it('is true for the traveling-bolt archetypes (damage lands on arrival)', () => {
    expect(archetypeIsProjectile('projectile')).toBe(true);  // bolt cast
    expect(archetypeIsProjectile('blast')).toBe(true);       // bursting bolt cast
    expect(archetypeIsProjectile('arrow')).toBe(true);       // bow auto-attack
    expect(archetypeIsProjectile('magicBolt')).toBe(true);   // staff auto-attack
  });
  it('is false for on-the-spot archetypes (damage lands at cast)', () => {
    for (const a of ['aura', 'slash', 'arcWide', 'nova', 'beam', 'chain',
                     'blinkStrike', 'conjure', 'multiStrike', 'impact',
                     'smash', 'thrust', 'slashDouble', 'scytheArc', 'jab', 'slashArc']) {
      expect(archetypeIsProjectile(a)).toBe(false);
    }
  });
  it('matches every cast SHAPE and weapon STYLE that flies a bolt', () => {
    // The classifier must agree with the archetype each shape/style resolves to,
    // so resolveCast / attackEnemy defer exactly the attacks that spawn a bolt.
    expect(archetypeIsProjectile(castArchetype('bolt'))).toBe(true);
    expect(archetypeIsProjectile(castArchetype('blast'))).toBe(true);
    expect(archetypeIsProjectile(castArchetype('nova'))).toBe(false);
    expect(archetypeIsProjectile(castArchetype('line'))).toBe(false);   // beam, instant
    expect(archetypeIsProjectile(castArchetype('chain'))).toBe(false);  // arcs, instant
    expect(archetypeIsProjectile(weaponArchetype('shot'))).toBe(true);
    expect(archetypeIsProjectile(weaponArchetype('bolt'))).toBe(true);
    expect(archetypeIsProjectile(weaponArchetype('slash'))).toBe(false);
  });
  it('is false for unknown archetypes', () => {
    expect(archetypeIsProjectile('mystery')).toBe(false);
    expect(archetypeIsProjectile(undefined)).toBe(false);
    expect(archetypeIsProjectile(null)).toBe(false);
  });
});

describe('hashStr', () => {
  it('is deterministic and returns an unsigned 32-bit int', () => {
    for (const s of ['', 'a', 'Judgment Day', 't_a54|Judgment Day']) {
      const h = hashStr(s);
      expect(h).toBe(hashStr(s));
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
  it('coerces nullish input to the empty string (no throw)', () => {
    expect(hashStr(null)).toBe(hashStr(''));
    expect(hashStr(undefined)).toBe(hashStr(''));
  });
  it('separates inputs that differ only by field boundary', () => {
    // The signature keys on `id + '|' + name`, so "a|b" must not collide with "ab|".
    expect(hashStr('a|b')).not.toBe(hashStr('ab|'));
  });
});

describe('castSignature', () => {
  it('is deterministic — a spell always maps to the same signature', () => {
    expect(castSignature('t_a54', 'Judgment Day')).toEqual(castSignature('t_a54', 'Judgment Day'));
  });
  it('always yields a real glyph and in-range channels', () => {
    for (const id of ['w_a00', 'm_a50', 'cr_judgment', 'r_a11', 'nc_golem', 'zzz']) {
      const s = castSignature(id, id);
      expect(SIGIL_GLYPHS).toContain(s.glyph);
      expect(s.points).toBeGreaterThanOrEqual(5);
      expect(s.points).toBeLessThanOrEqual(10);
      expect(s.rings).toBeGreaterThanOrEqual(2);
      expect(s.rings).toBeLessThanOrEqual(4);
      expect([1, -1]).toContain(s.spin);
      expect(s.twist).toBeGreaterThanOrEqual(0);
      expect(s.twist).toBeLessThan(Math.PI * 2);
    }
  });
  it('gives the two example holy novas different sigils', () => {
    // The bug report: Templar "Judgment Day" and Crusader "Final Judgment" are both
    // holy novas and looked identical. Their signatures must now differ.
    const jday = castSignature('t_a54', 'Judgment Day');
    const fjudg = castSignature('cr_judgment', 'Final Judgment');
    expect(jday).not.toEqual(fjudg);
    // and specifically the rune the player sees is different
    expect(visualKey(jday)).not.toBe(visualKey(fjudg));
  });
});

// The rendered look of a sigil is its glyph + the channels the drawers vary.
function visualKey(sig) { return [sig.glyph, sig.points, sig.spin, sig.rings].join(':'); }

describe('every active skill casts a distinct sigil', () => {
  // Parse the real skill trees out of the (giant) legacy monolith so this guarantee
  // tracks the actual game data instead of a fixture that drifts. Two spells that
  // share an element (colour) and archetype (shape) — e.g. the holy novas, the two
  // dozen "gold" self-buffs — used to render identically; the per-spell signature
  // must give each of them its own visual key.
  const src = readFileSync(resolve(process.cwd(), 'src/legacy/game.js'), 'utf8');
  const rows = [];
  const push = (id, name, shape) => rows.push({ id, name, shape });
  // JSON-ish class-tree nodes: {"id":"…","name":"…", … "cast":{ … "shape":"…" …
  const reA = /"id"\s*:\s*"([^"]+)"[^\n]*?"name"\s*:\s*"([^"]+)"[^\n]*?"cast"\s*:\s*\{[^\n]*?"shape"\s*:\s*"([a-z]+)"/g;
  // Terser ascendancy-path nodes: {id:'…',name:'…',icon:'…',t:'active',…cast:{shape:'…'
  const reB = /\{id:'([^']+)',name:'([^']+)',icon:'[^']*',t:'active'[^\n]*?cast:\{shape:'([a-z]+)'/g;
  let m;
  while ((m = reA.exec(src))) push(m[1], m[2], m[3]);
  while ((m = reB.exec(src))) push(m[1], m[2], m[3]);
  const byId = new Map();
  for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);
  const skills = [...byId.values()];

  it('parsed a plausible number of active skills (guards the regex)', () => {
    expect(skills.length).toBeGreaterThanOrEqual(140);
  });

  it('no two spells sharing an element + archetype render the same sigil', () => {
    const seen = new Map();       // "element|archetype|visualKey" -> first spell name
    const clashes = [];
    for (const s of skills) {
      const el = elementOf(s.name);
      const arch = castArchetype(s.shape);
      const key = `${el}|${arch}|${visualKey(castSignature(s.id, s.name))}`;
      if (seen.has(key)) clashes.push(`${seen.get(key)} == ${s.name} (${key})`);
      else seen.set(key, s.name);
    }
    expect(clashes).toEqual([]);
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
