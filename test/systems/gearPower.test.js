import { describe, it, expect } from 'vitest';
import {
  combatScore, powerScalar, offenseScore, defenseScore, applyDelta, marginalPower,
} from '../../src/systems/gearPower.js';
import { GEAR_POWER } from '../../src/data/gearPower.js';

// A representative fresh level-1 warrior context (base attributes 10 each, fists,
// no gear). Overrides let each test model a different build cheaply. These mirror
// what the legacy adapter gathers from the live derived-stat functions.
function freshCtx(over = {}) {
  return Object.assign({
    refLevel: 1, weaponAvg: 2, atkFlat: 34, idmgPct: 0, critRating: 8.5, critMult: 2.0,
    skillPwrPct: 0, spellCore: 44, spellPwrPct: 0, atkSpdPct: 0, castSpdPct: 0, cdrRating: 0,
    penPct: 0, magicPenPct: 0, dblStrikePct: 0, cleavePct: 0, bossDmgPct: 0, execPct: 0, bleedPct: 0, stunPct: 0,
    accRating: 112, offMult: 1.10, skillReliance: 1.0, spellReliance: 0.25,
    maxHp: 118, def: 5, dodgeRating: 11.5, blockRating: 0, drRating: 0, dmgTakenMult: 0.90,
    regen: 0.6, thornsPct: 0, tenacPct: 0, leechPct: 0, hpKill: 0,
  }, over);
}
const mageCtx = over => freshCtx(Object.assign({ skillReliance: 0.35, spellReliance: 1.0, offMult: 1.0 }, over));

describe('combatScore / channels', () => {
  it('offense and survivability are finite and positive for a fresh hero', () => {
    const c = freshCtx();
    expect(offenseScore(c)).toBeGreaterThan(0);
    expect(defenseScore(c)).toBeGreaterThan(0);
    expect(Number.isFinite(combatScore(c))).toBe(true);
  });

  it('never produces NaN/Infinity for a naked, zero-stat, or zero-HP hero', () => {
    const naked = { refLevel: 1, weaponAvg: 2, atkFlat: 0, critMult: 2, spellCore: 0,
      offMult: 1, skillReliance: 1, spellReliance: 0.25, accRating: 0, maxHp: 1, def: 0, dmgTakenMult: 1 };
    expect(Number.isFinite(combatScore(naked))).toBe(true);
    expect(combatScore(naked)).toBeGreaterThan(0);
    // Empty-ish context: missing fields treated as 0, still finite.
    expect(Number.isFinite(combatScore({ refLevel: 1, critMult: 0, offMult: 0, skillReliance: 0, spellReliance: 0, maxHp: 0, dmgTakenMult: 1 }))).toBe(true);
    // Fully-stacked defence can't divide by zero (mitigation floored).
    const tank = freshCtx({ dodgeRating: 1e6, drRating: 1e6, blockRating: 1e6, def: 1e6, maxHp: 1e6 });
    expect(Number.isFinite(defenseScore(tank))).toBe(true);
  });

  it('is monotonic — more of any combat stat never lowers the score', () => {
    const c = freshCtx();
    const base = combatScore(c);
    expect(combatScore(applyDelta(c, { atkFlat: 20 }))).toBeGreaterThan(base);
    expect(combatScore(applyDelta(c, { maxHp: 50 }))).toBeGreaterThan(base);
    expect(combatScore(applyDelta(c, { def: 30 }))).toBeGreaterThan(base);
    expect(combatScore(applyDelta(c, { critRating: 40 }))).toBeGreaterThan(base);
    expect(combatScore(applyDelta(c, { dodgeRating: 30 }))).toBeGreaterThan(base);
  });
});

describe('calibration — fresh-hero Power stays on the old ~100-300 scale', () => {
  it('every class fresh hero reads a sane, comparable Power', () => {
    for (const c of [freshCtx(), mageCtx(), freshCtx({ skillReliance: 1.0, spellReliance: 0.25 }),
      freshCtx({ skillReliance: 0.85, spellReliance: 0.7, dmgTakenMult: 0.85, maxHp: 142 })]) {
      const power = Math.round(GEAR_POWER.K * powerScalar(c));
      expect(power).toBeGreaterThan(120);
      expect(power).toBeLessThan(320);
    }
  });

  it('the concave exponent compresses without inverting: Power stays monotone in the build', () => {
    // A much stronger build reads higher Power, but the compressed scale grows far
    // slower than the raw combat score (so an endgame build can't balloon 10x).
    const weak = freshCtx();
    const strong = freshCtx({ atkFlat: 300, critRating: 120, critMult: 3, maxHp: 900, def: 200, weaponAvg: 60 });
    const pWeak = GEAR_POWER.K * powerScalar(weak);
    const pStrong = GEAR_POWER.K * powerScalar(strong);
    expect(pStrong).toBeGreaterThan(pWeak);                       // monotone
    const rawRatio = combatScore(strong) / combatScore(weak);
    const powRatio = pStrong / pWeak;
    expect(powRatio).toBeLessThan(rawRatio);                      // compression really compresses
  });
});

describe('Crit Damage is valued by the hero it is viewed on (the flagship case)', () => {
  it('adds ZERO Power to a build with no crit chance', () => {
    const noCrit = freshCtx({ critRating: 0 });
    expect(marginalPower(noCrit, { critMult: 0.30 })).toBe(0);
  });

  it('is worth progressively more as crit chance climbs', () => {
    const low = marginalPower(freshCtx(), { critMult: 0.30 });
    const hi = marginalPower(freshCtx({ critRating: 120, critMult: 2.5 }), { critMult: 0.30 });
    expect(low).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(low * 2); // a crit build values it far more
  });

  it('a Crit Damage roll is worth far less than raw Attack for a no-crit build', () => {
    const c = freshCtx({ critRating: 0 });
    expect(marginalPower(c, { critMult: 0.30 })).toBeLessThan(marginalPower(c, { atkFlat: 10 }));
  });
});

describe('stats are gated to the build/class that actually uses them', () => {
  it('Spell Power is worth much more to a caster than a martial build', () => {
    const warrior = marginalPower(freshCtx(), { spellPwrPct: 30 });
    const mage = marginalPower(mageCtx(), { spellPwrPct: 30 });
    expect(mage).toBeGreaterThan(warrior * 2);
  });

  it('Attack Speed is worth much more to a martial build than a caster', () => {
    const warrior = marginalPower(freshCtx(), { atkSpdPct: 30 });
    const mage = marginalPower(mageCtx(), { atkSpdPct: 30 });
    expect(warrior).toBeGreaterThan(mage * 2);
  });

  it('Life Leech scales with how hard you already hit', () => {
    const lowDps = marginalPower(freshCtx(), { leechPct: 10 });
    const hiDps = marginalPower(freshCtx({ atkFlat: 434 }), { leechPct: 10 });
    expect(hiDps).toBeGreaterThan(lowDps * 3);
  });

  it('Armor Pen helps the martial lane and Magic Pen the spell lane', () => {
    // For a martial hero, Armor Pen buys far more offense than Magic Pen (whose only
    // grip is the thin 0.25 spell-reliance lane).
    const warrior = freshCtx();
    const wArmor = offenseScore(applyDelta(warrior, { penPct: 40 })) - offenseScore(warrior);
    const wMagic = offenseScore(applyDelta(warrior, { magicPenPct: 40 })) - offenseScore(warrior);
    expect(wArmor).toBeGreaterThan(0);
    expect(wMagic).toBeGreaterThan(0); // small but nonzero — a warrior still casts a little
    expect(wArmor).toBeGreaterThan(wMagic * 2);
    // For a caster, the ranking flips: Magic Pen buys more offense than Armor Pen.
    const mage = mageCtx();
    const mArmor = offenseScore(applyDelta(mage, { penPct: 40 })) - offenseScore(mage);
    const mMagic = offenseScore(applyDelta(mage, { magicPenPct: 40 })) - offenseScore(mage);
    expect(mMagic).toBeGreaterThan(mArmor);
  });

  it('Magic Pen is worth much more to a caster than to a martial build', () => {
    const warrior = marginalPower(freshCtx(), { magicPenPct: 30 });
    const mage = marginalPower(mageCtx(), { magicPenPct: 30 });
    expect(mage).toBeGreaterThan(warrior * 2);
  });
});

describe('applyDelta / marginalPower', () => {
  it('applyDelta does not mutate the base context', () => {
    const c = freshCtx();
    const snap = JSON.stringify(c);
    applyDelta(c, { atkFlat: 100 });
    expect(JSON.stringify(c)).toBe(snap);
  });

  it('sign −1 subtracts, and add-then-subtract round-trips', () => {
    const c = freshCtx();
    const added = applyDelta(c, { atkFlat: 25 });
    const back = applyDelta(added, { atkFlat: 25 }, -1);
    expect(back.atkFlat).toBeCloseTo(c.atkFlat, 9);
  });

  it('marginalPower is the scaled score delta and is symmetric across add/remove', () => {
    const base = freshCtx();
    const delta = { atkFlat: 30, critRating: 15 };
    const loose = marginalPower(base, delta);                       // value if we ADD it
    const withIt = applyDelta(base, delta);
    const equipped = marginalPower(applyDelta(withIt, delta, -1), delta); // value of the worn piece
    expect(loose).toBeGreaterThan(0);
    expect(equipped).toBeCloseTo(loose, 6);
  });

  it('a pure curse (negative delta) reads as negative marginal Power', () => {
    expect(marginalPower(freshCtx(), { atkFlat: -20 })).toBeLessThan(0);
  });
});
