import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { skillManaCost } from '../../src/systems/skillMath.js';
import { STAFF_BOLT_MP, SKILL_MP_MULT } from '../../src/data/skillCosts.js';

// DATA-VALIDITY TEST — every active's mana price, audited as a RATE.
//
// The bug this exists to catch: a skill's cost is authored PER CAST, but what a
// player actually feels is cost ÷ cooldown — the mana per second it demands if cast
// on cooldown. The Mage's four opening bolts were authored at 6-7 MP, right in line
// with every other class's 6-8 MP opener, but on a ONE-second cooldown against
// everyone else's 2-4 — so they silently demanded 6-7 MP/sec where the rest of the
// game asked 1.7-3.5. The per-cast number looked fine; the tax hid in the cadence.
//
// So: pin the RATE, not the number. A new skill (or a cooldown tweak on an old one)
// that lands outside the band the rest of the game occupies fails here.

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../../src/legacy/game.js');

const CLASS_OF = { w: 'warrior', r: 'rogue', m: 'mage', t: 'templar', f: 'fortune', z: 'windblade', l: 'bloodletter' };

let actives;
beforeAll(() => {
  const src = readFileSync(GAME, 'utf8');
  actives = [];
  for (const line of src.split('\n')) {
    const t = line.trim().replace(/,$/, '');
    if (!t.startsWith('{"id":"') || !t.includes('"cast":')) continue;
    let n;
    try { n = JSON.parse(t); } catch { continue; }
    if (n && n.id && n.cast) actives.push(n);
  }
});

// The sustained demand of casting a skill on cooldown forever, in MP per second.
const demand = (n, rank = 1) => skillManaCost(n, rank) / n.cd;

describe('skill mana costs — every active is priced as a RATE, not just a number', () => {
  it('finds the whole active roster (7 classes x 30)', () => {
    expect(actives.length).toBe(210);
  });

  it('gives every active both an mp cost and a cooldown — a rate needs both', () => {
    for (const n of actives) {
      expect(n.mp, `${n.id} ${n.name} has no mp`).toBeGreaterThan(0);
      expect(n.cd, `${n.id} ${n.name} has no cd`).toBeGreaterThan(0);
    }
  });

  it('keeps every skill inside the sustained-demand band the game is tuned around', () => {
    // 5.5 MP/sec is the ceiling: above it a skill outruns even a Mage's in-combat
    // regen at max level, which is what "unplayable without a flask" felt like.
    const hot = actives.filter(n => demand(n) > 5.5)
      .map(n => `${CLASS_OF[n.id[0]]}/${n.name} ${skillManaCost(n, 1)} MP / ${n.cd}s = ${demand(n).toFixed(2)} MP/s`);
    expect(hot, `skills demanding more mana per second than the game can supply:\n  ${hot.join('\n  ')}`).toEqual([]);
  });

  it('holds the OPENERS (band 0) to a gentler ceiling — they are what a new hero has', () => {
    // A band-0 skill is cast from level 1 with a starting pool and no gear. The Mage's
    // bolts sat at 6-7 MP/s here; the rest of the game's openers span 0.50-3.50.
    const hot = actives.filter(n => n.band === 0 && demand(n) > 4.0)
      .map(n => `${CLASS_OF[n.id[0]]}/${n.name} ${skillManaCost(n, 1)} MP / ${n.cd}s = ${demand(n).toFixed(2)} MP/s`);
    expect(hot, `openers priced above the band-0 ceiling:\n  ${hot.join('\n  ')}`).toEqual([]);
  });

  it('never lets a fast-cadence skill hide a high rate behind a small number', () => {
    // The specific shape of the original bug: cd <= 1 with a cost priced for a slower
    // skill. Anything on a 1s cadence has to be genuinely cheap per cast.
    for (const n of actives.filter(x => x.cd <= 1)) {
      expect(skillManaCost(n, 1), `${n.id} ${n.name} fires every ${n.cd}s — its per-cast cost must stay small`)
        .toBeLessThanOrEqual(4);
    }
  });

  it('keeps cost growth with rank well under damage growth, at every skill', () => {
    // Ranking a skill must never make it harder to sustain: cost climbs ~1.7x to
    // rank 10 while rankScale reaches ~3.7x.
    for (const n of actives) {
      const growth = skillManaCost(n, 10) / skillManaCost(n, 1);
      expect(growth, `${n.id} ${n.name}`).toBeLessThan(2);
    }
  });
});

describe('the global cost dials stay honest', () => {
  it('charges a skill its authored table value, with no hidden multiplier', () => {
    // SKILL_MP_MULT was 1.5 — a 50% surcharge on all 210 tables at once, invisible
    // at every call site. Keeping it at 1 means tuning a skill means editing its mp.
    expect(SKILL_MP_MULT).toBe(1);
    const sample = actives.find(n => n.id === 'm_a00');
    expect(skillManaCost(sample, 1)).toBe(sample.mp);
  });
});

describe('the Staff bolt — the one mana cost that is not a skill cast', () => {
  let src;
  beforeAll(() => { src = readFileSync(GAME, 'utf8'); });

  it('is a named constant, not a literal repeated across the two attack paths', () => {
    expect(STAFF_BOLT_MP).toBeGreaterThan(0);
    // Both the ranged poke and the auto-attack loop go through the shared helpers.
    expect(src).toContain('function staffBoltCost()');
    expect(src).toContain('if (bolt && !canPayStaffBolt()) return false;');
    expect(src).toContain("if (style === 'bolt') { if (!canPayStaffBolt()) return; payStaffBolt(); }");
    // The bare `4` in both paths is gone for good.
    expect(src).not.toContain('player.mp < 4');
    expect(src).not.toContain('player.mp -= 4');
  });

  it('is discounted by Mana Cost Reduction, like any other mana price', () => {
    expect(src).toContain('skillCastCost(STAFF_BOLT_MP)');
  });

  it('is free for a hero with no mana pool, who could never pay it', () => {
    // A Bloodletter (maxMp 0) failed the old `mp < 4` check on EVERY swing and so
    // silently never auto-attacked at all while holding a Staff.
    expect(src).toContain('return classNoMana() ? 0 : skillCastCost(STAFF_BOLT_MP)');
  });

  it('stays cheap enough that a caster\'s basic attack is not their whole income', () => {
    // A Staff swings every ~1.7s (PLAYER_ATK_BASE 1.5 x STYLE_ATK_MULT.bolt 1.15),
    // so the per-shot cost is a SUSTAINED rate. At 4 MP it was 2.3 MP/s — 95% of a
    // level-10 Mage's entire in-combat regen, before casting anything.
    const perSec = STAFF_BOLT_MP / (1.5 * 1.15);
    expect(perSec).toBeLessThan(1.5);
  });

  it('is reported to an agent budgeting mana', () => {
    expect(src).toContain('boltCost:');
  });
});
