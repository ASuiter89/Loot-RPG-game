import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GEAR_POWER } from '../../src/data/gearPower.js';
import { EARLY_SUSTAIN_ILVL, EARLY_SUSTAIN_CHANCE, EARLY_SUSTAIN_STATS } from '../../src/data/onboarding.js';

// CHARACTERIZATION TEST — Mana Regen (MPREG) is the mana twin of the HP-regen affix
// (REGEN): a flat +MP/sec trickle that lets a caster buy mana sustain on gear instead
// of Spirit alone. A gear stat is only "real" when it's wired everywhere at once — a
// label, a short code, a hover blurb, a roll curve, a slot pool, a Power weight and
// the actual regen math. Adding it to a pool but forgetting (say) its curve would
// silently roll it with the wrong magnitude and no name. This locks those touch-points
// together, and pins the early-game sustain bias that makes both regen stats show up
// early rather than only on later high-affix gear.

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../../src/legacy/game.js');
let game;
beforeAll(() => { game = readFileSync(GAME, 'utf8'); });

describe('Mana Regen gear stat — Power pricing (src/data/gearPower.js)', () => {
  it('carries a positive flat Power weight so a mana-sustain piece never reads 0', () => {
    expect(GEAR_POWER.utilityFlat.MPREG).toBeGreaterThan(0);
  });
});

describe('Mana Regen gear stat — wired through the legacy stat system', () => {
  it('has a friendly label and a short code for tooltips / the item line', () => {
    expect(game).toContain("MPREG:'Mana Regen'");
    expect(game).toContain("MPREG:'MRG'");
  });

  it('has a hover blurb explaining what it does', () => {
    expect(game).toMatch(/MPREG:\s*'Mana regen over time/);
  });

  it('rolls with a flat curve — a small /sec add, gentler than HP regen', () => {
    const mpreg = game.match(/MPREG:\{flat:([\d.]+)\}/);
    const regen = game.match(/REGEN:\{flat:([\d.]+)\}/);
    expect(mpreg, 'MPREG missing from AFFIX_CURVES').toBeTruthy();
    expect(regen, 'REGEN missing from AFFIX_CURVES').toBeTruthy();
    const mpregFlat = Number(mpreg[1]);
    const regenFlat = Number(regen[1]);
    expect(mpregFlat).toBeGreaterThan(0);
    // Its per-second value is ×TICKS_PER_SEC in mpRegenPerSec and mana is rationed, so
    // its per-item-level growth stays under the HP-regen slope.
    expect(mpregFlat).toBeLessThan(regenFlat);
  });

  it('is a flat stat, never a percentage (so it never shows a trailing %)', () => {
    const pct = game.match(/const PCT_STATS = new Set\(\[([\s\S]*?)\]\);/);
    expect(pct, 'PCT_STATS block not found').toBeTruthy();
    expect(pct[1]).not.toContain('MPREG');
  });

  it('rolls on the mana/sustain slots (helm, chest, legs, amulet, off-hand), each beside HP regen', () => {
    // Every sustain slot that offers HP regen offers mana regen right alongside it.
    const pairs = game.match(/'REGEN','MPREG'/g) || [];
    expect(pairs.length).toBeGreaterThanOrEqual(5);
  });

  it('actually feeds the mana-regen rate, alongside Spirit and passive bonuses', () => {
    // The shell sums the sources and hands them to systems/manaRegen.js, which owns
    // the SHAPE (flat floor + share of max MP + the in-combat ration).
    expect(game).toContain("gear: totalStat('MPREG')");
    expect(game).toContain("spirit: totalAttr('spirit') * attrCoef('mpRegen')");
    expect(game).toContain("skills: skillBonus('mpRegen')");
    expect(game).toContain('calcMpRegenPerSec(');
  });

  it('rides the same in-combat ration as every other mana source', () => {
    // One gate, applied in one place — gear regen must never dodge the ration.
    expect(game).toContain('gatedMpRegen(_mpRegenRate, player._combatSecs > 0)');
  });
});

describe('Early-game sustain bias (src/data/onboarding.js)', () => {
  it('favours both regen stats below a low item-level threshold', () => {
    expect(EARLY_SUSTAIN_STATS).toContain('REGEN');
    expect(EARLY_SUSTAIN_STATS).toContain('MPREG');
    expect(EARLY_SUSTAIN_ILVL).toBeGreaterThan(0);
    // A modest nudge, never a guarantee — early loot must still roll varied stats.
    expect(EARLY_SUSTAIN_CHANCE).toBeGreaterThan(0);
    expect(EARLY_SUSTAIN_CHANCE).toBeLessThan(1);
  });

  it('is applied in the affix draw, gated on item level', () => {
    expect(game).toContain('lvl <= EARLY_SUSTAIN_ILVL');
    expect(game).toContain('EARLY_SUSTAIN_STATS.includes(s)');
  });
});
