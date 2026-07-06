import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GEAR_POWER } from '../../src/data/gearPower.js';

// CHARACTERIZATION TEST — the two Stamina gear stats (Max Stamina STAM / Stamina
// Regen STAMREG) let a class that never invests in Vitality still buy a deeper,
// faster-refilling sprint/dash reserve on gear. A gear stat is only "real" when it
// is wired everywhere at once: a label, a short code, a hover blurb, a roll curve,
// a slot pool, a Power weight and the actual max/regen math. Adding it to a pool
// but forgetting (say) its curve would silently roll it with the wrong magnitude and
// no name. This locks all those touch-points together so they can't drift apart.

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../../src/legacy/game.js');
let game;
beforeAll(() => { game = readFileSync(GAME, 'utf8'); });

describe('Stamina gear stats — Power pricing (src/data/gearPower.js)', () => {
  it('both stats carry a positive flat Power weight so a utility piece never reads 0', () => {
    expect(GEAR_POWER.utilityFlat.STAM).toBeGreaterThan(0);
    expect(GEAR_POWER.utilityFlat.STAMREG).toBeGreaterThan(0);
    // Max Stamina rolls a big pool number, so it is priced very lightly per point
    // (like MP); a point of regen is scarcer and worth more.
    expect(GEAR_POWER.utilityFlat.STAM).toBeLessThan(GEAR_POWER.utilityFlat.STAMREG);
  });
});

describe('Stamina gear stats — wired through the legacy stat system', () => {
  it('has a friendly label and a short code for tooltips / the item line', () => {
    expect(game).toContain("STAM:'Max Stamina'");
    expect(game).toContain("STAMREG:'Stamina Regen'");
    expect(game).toContain("STAM:'STM'");
    expect(game).toContain("STAMREG:'SRG'");
  });

  it('has a hover blurb explaining what each does', () => {
    expect(game).toMatch(/STAM:\s*'Deepens your Stamina pool/);
    expect(game).toMatch(/STAMREG:\s*'Refills your Stamina faster/);
  });

  it('rolls with a flat curve — Max Stamina a large pool add, Regen a small /sec add', () => {
    const stam = game.match(/STAM:\{flat:([\d.]+)\}/);
    const reg = game.match(/STAMREG:\{flat:([\d.]+)\}/);
    expect(stam, 'STAM missing from AFFIX_CURVES').toBeTruthy();
    expect(reg, 'STAMREG missing from AFFIX_CURVES').toBeTruthy();
    const stamFlat = Number(stam[1]);
    const regFlat = Number(reg[1]);
    expect(stamFlat).toBeGreaterThan(0);
    expect(regFlat).toBeGreaterThan(0);
    // The pool add rolls far bigger per item level than the per-second refill add.
    expect(stamFlat).toBeGreaterThan(regFlat);
  });

  it('are flat stats, never percentages (so they never show a trailing %)', () => {
    const pct = game.match(/const PCT_STATS = new Set\(\[([\s\S]*?)\]\);/);
    expect(pct, 'PCT_STATS block not found').toBeTruthy();
    expect(pct[1]).not.toContain('STAM'); // also covers STAMREG (superstring of STAM)
  });

  it('roll on the endurance/mobility slots (chest, legs, amulet)', () => {
    // Every slot pool that offers stamina lists BOTH stats together.
    const pairs = game.match(/'STAM','STAMREG'/g) || [];
    expect(pairs.length).toBeGreaterThanOrEqual(3);
  });

  it('actually feed the Max Stamina pool and its refill rate', () => {
    expect(game).toContain("vitalityAboveBase() * attrCoef('staminaMax') + totalStat('STAM')");
    expect(game).toContain("vitalityAboveBase() * attrCoef('staminaRegen') + totalStat('STAMREG')");
  });
});
