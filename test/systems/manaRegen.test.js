import { describe, it, expect } from 'vitest';
import { mpRegenPerSec, gatedMpRegen, secondsToFullMp } from '../../src/systems/manaRegen.js';
import {
  MP_REGEN_FLAT_PER_BEAT, MP_REGEN_PCT_PER_BEAT, MANA_COMBAT_REGEN_MULT,
} from '../../src/data/manaRegen.js';

const TPS = 2.5; // world beats per real second, matching the shell's TICKS_PER_SEC

describe('mpRegenPerSec — the shape of the mana trickle', () => {
  it('pays the flat floor even with no pool, no Spirit and no gear', () => {
    expect(mpRegenPerSec({}, TPS)).toBeCloseTo(MP_REGEN_FLAT_PER_BEAT * TPS, 6);
  });

  it('adds a share of MAX MP, so a deeper pool refills faster', () => {
    const small = mpRegenPerSec({ maxMp: 100 }, TPS);
    const big = mpRegenPerSec({ maxMp: 200 }, TPS);
    expect(big).toBeGreaterThan(small);
    expect(big - small).toBeCloseTo(MP_REGEN_PCT_PER_BEAT * 100 * TPS, 6);
  });

  it('sums Spirit, gear and passive bonuses on top of the baseline', () => {
    const base = mpRegenPerSec({ maxMp: 100 }, TPS);
    const kitted = mpRegenPerSec({ maxMp: 100, spirit: 0.2, gear: 0.3, skills: 0.5 }, TPS);
    expect(kitted - base).toBeCloseTo((0.2 + 0.3 + 0.5) * TPS, 6);
  });

  it('scales the Clarity shrine by the pool, in the shrine\'s own per-beat units', () => {
    const base = mpRegenPerSec({ maxMp: 150 }, TPS);
    const shrined = mpRegenPerSec({ maxMp: 150, shrinePctMp: 0.02 }, TPS);
    expect(shrined - base).toBeCloseTo(0.02 * 150 * TPS, 6);
  });

  it('never returns a negative rate, whatever garbage it is handed', () => {
    expect(mpRegenPerSec({ maxMp: -500, spirit: -9 }, TPS)).toBeGreaterThanOrEqual(0);
    expect(mpRegenPerSec(null, TPS)).toBeGreaterThanOrEqual(0);
    expect(mpRegenPerSec({ maxMp: NaN, gear: 'lots' }, TPS)).toBeCloseTo(MP_REGEN_FLAT_PER_BEAT * TPS, 6);
    expect(mpRegenPerSec({ maxMp: 100 }, -5)).toBe(0);
  });

  it('keeps REFILL TIME roughly flat as the pool grows — the bug it was added to kill', () => {
    // A hero who never invests Spirit: pool grows with level, regen used to not.
    const lo = secondsToFullMp(50, mpRegenPerSec({ maxMp: 50 }, TPS));
    const hi = secondsToFullMp(400, mpRegenPerSec({ maxMp: 400 }, TPS));
    // Under a flat-only trickle this ratio was ~8x; the pool share holds it near 1.
    expect(hi / lo).toBeLessThan(1.5);
    // A flat-only baseline, for contrast, stretches badly.
    const flatLo = secondsToFullMp(50, MP_REGEN_FLAT_PER_BEAT * TPS);
    const flatHi = secondsToFullMp(400, MP_REGEN_FLAT_PER_BEAT * TPS);
    expect(flatHi / flatLo).toBeCloseTo(8, 5);
  });
});

describe('gatedMpRegen — the in-combat ration', () => {
  it('passes the full rate through out of combat', () => {
    expect(gatedMpRegen(4, false)).toBe(4);
  });

  it('rations it in combat, without stopping it', () => {
    expect(gatedMpRegen(4, true)).toBeCloseTo(4 * MANA_COMBAT_REGEN_MULT, 6);
    expect(gatedMpRegen(4, true)).toBeGreaterThan(0);
    expect(gatedMpRegen(4, true)).toBeLessThan(4);
  });

  it('clamps a negative or garbage rate to zero', () => {
    expect(gatedMpRegen(-3, false)).toBe(0);
    expect(gatedMpRegen(NaN, true)).toBe(0);
    expect(gatedMpRegen(undefined, false)).toBe(0);
  });
});

describe('secondsToFullMp — refill time from an empty bar', () => {
  it('is pool over rate', () => {
    expect(secondsToFullMp(100, 4)).toBe(25);
  });

  it('is Infinity when nothing regenerates', () => {
    expect(secondsToFullMp(100, 0)).toBe(Infinity);
    expect(secondsToFullMp(100, NaN)).toBe(Infinity);
  });
});
