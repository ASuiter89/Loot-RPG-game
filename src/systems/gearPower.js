// Build-aware gear Power — pure combat-score math. Numbers in, numbers out; no
// globals, no RNG, no DOM, no clock. The legacy adapter (src/legacy/game.js)
// reads the live build (attributes, skills, worn gear, class) into a flat
// numeric CONTEXT and maps each item's affixes into a matching DELTA, then asks
// this module for the marginal combat score the delta buys.
//
// Why marginal: an item's Power should be what its affixes are worth to THIS
// hero, not a fixed table. combatScore(ctx) is an effective combat rating built
// from the real formulas — a blend of effective offense (DPS) and survivability
// (EHP) — with every stat's value flowing through the nonlinear channels (crit
// EXPECTATION, the rating→chance curves, the mitigation product, class reliance
// gating). So Crit Damage on a hero with no crit chance moves the score ~0, and
// its Power reads ~0; Life Leech is worth more the harder you already hit; Attack
// Speed does nothing for a pure caster. See src/data/gearPower.js for tuning and
// test/systems/gearPower.test.js for the calibration and the crit-damage case.
import { GEAR_POWER } from '../data/gearPower.js';
import { rated } from './ratings.js';

// ── Reference opposition at a stable level (see data notes) ──
function critOpp(L, T)  { return T.critOppBase  + L * T.critOppPerLvl; }
function blockOpp(L, T) { return T.blockOppBase + L * T.blockOppPerLvl; }
function drOpp(L, T)    { return T.drOppBase    + L * T.drOppPerLvl; }
function enemyEva(L, T) { return T.enemyEvaBase + L * T.enemyEvaPerLvl; }
function enemyAcc(L, T) { return T.enemyAccBase + L * T.enemyAccPerLvl; }

const pos = v => (v > 0 ? v : 0);

// Effective single-target DPS proxy (arbitrary units; only ratios matter — the
// score normalizes by offRef). Blends a martial lane (autos + weapon skills) and
// a spell lane by the class's reliance, gating each speed/power lever to its lane.
export function offenseScore(c, T = GEAR_POWER) {
  const L = c.refLevel;
  // Expected crit multiplier on an average hit.
  const critChance = rated(pos(c.critRating), critOpp(L, T));
  const critAvg = 1 + critChance * pos(c.critMult - 1);
  // Armor a representative foe shrugs off, softened by your Armor Penetration.
  const pen = pos(c.penPct) / 100;
  const armorFrac = 1 - T.refArmorPct * (1 - pen / (pen + T.penScale));
  // Cooldown Reduction speeds every active (weapon skills AND spells).
  const cdrFrac = rated(pos(c.cdrRating), T.cdrScale);

  // Martial: weapon roll + flat Attack, hit by half your damage as never-miss
  // weapon skills (Skill Power + CDR) and half as auto-attacks (can miss).
  const base = pos(c.weaponAvg + c.atkFlat) * (1 + pos(c.idmgPct) / 100);
  const attackRate = T.attackRateBase * (1 + pos(c.atkSpdPct) / 100) * (1 + pos(c.dblStrikePct) / 100);
  const hit = rated(pos(c.accRating), enemyEva(L, T));
  const martialDps = base * (
    T.autoShare * attackRate * hit +
    T.skillShare * attackRate * (1 + pos(c.skillPwrPct) / 100) * (1 + cdrFrac)
  );
  // Spell: Spirit-driven base × Spell Power, recharged by Cast Speed + CDR.
  const castRate = T.castRateBase * (1 + pos(c.castSpdPct) / 100) * (1 + cdrFrac);
  const spellDps = pos(c.spellCore) * castRate * (1 + pos(c.spellPwrPct) / 100);

  let dps = (c.skillReliance * martialDps + c.spellReliance * spellDps) * c.offMult * critAvg * armorFrac;
  // Situational amps count at a discount (only fire in some fights).
  dps *= 1 + T.bossW * pos(c.bossDmgPct) / 100 + T.execW * pos(c.execPct) / 100
    + T.cleaveW * pos(c.cleavePct) / 100 + T.bleedW * pos(c.bleedPct) / 100 + T.stunW * pos(c.stunPct) / 100;
  return Math.max(T.eps, dps);
}

// Effective HP proxy: max HP divided by the multiplicative mitigation chain
// (class damage-taken × dodge × half-block × DR × armor), plus minor sustain.
export function defenseScore(c, T = GEAR_POWER) {
  const L = c.refLevel;
  const dodge = rated(pos(c.dodgeRating), enemyAcc(L, T));
  const block = rated(pos(c.blockRating), blockOpp(L, T));
  const dr = rated(pos(c.drRating), drOpp(L, T));
  const def = pos(c.def);
  const armorMit = def / (def + T.armorFlat + L * T.armorPerLvl);
  const taken = Math.max(T.minTaken,
    c.dmgTakenMult * (1 - dodge) * (1 - T.blockAmt * block) * (1 - dr) * (1 - armorMit));
  let ehp = Math.max(1, c.maxHp) / taken;
  ehp *= 1 + T.thornsW * pos(c.thornsPct) / 100 + T.tenacW * pos(c.tenacPct) / 100;
  ehp += T.regenW * pos(c.regen);
  return Math.max(T.eps, ehp);
}

// Single scalar combat rating: normalized offense + survivability, plus leech
// sustain (worth a slice of your DPS as effective HP — so leech is dead weight
// with no damage and strong on a high-DPS build).
export function combatScore(c, T = GEAR_POWER) {
  const O = offenseScore(c, T);
  const D = defenseScore(c, T);
  const sustain = (pos(c.leechPct) / 100) * O * T.leechToEhp + pos(c.hpKill) * T.onKillW;
  return T.wOff * (O / T.offRef) + T.wDef * ((D + sustain) / T.defRef);
}

// The combat score compressed by a concave exponent, so raw multiplicative growth
// (effective offense is a product of multipliers) doesn't outrun the old ~additive
// Power scale. Monotone increasing, so it never inverts a real upgrade. Power
// numbers (headline + per-item) are all built on THIS, K·powerScalar, keeping the
// per-item Power exactly the marginal of the headline.
export function powerScalar(c, T = GEAR_POWER) {
  return Math.pow(Math.max(0, combatScore(c, T)), T.powerExp);
}

// A fresh copy of `base` with `delta` added (sign −1 to subtract). Only the axes
// present in `delta` change; fixed context (class reliance, level, multipliers)
// is never in a delta.
export function applyDelta(base, delta, sign = 1) {
  const out = Object.assign({}, base);
  for (const k in delta) {
    if (typeof delta[k] === 'number') out[k] = (out[k] || 0) + sign * delta[k];
  }
  return out;
}

// Raw (unrounded) Power the affix DELTA buys against the `base` build: the
// scaled marginal gain in combat score. The adapter adds flat utility/tier Power
// and rounds. Never negative-clamped here — a genuine downgrade (a curse) reads
// negative, which callers may use for arrows before clamping the displayed pill.
export function marginalPower(base, delta, T = GEAR_POWER) {
  return T.K * (powerScalar(applyDelta(base, delta), T) - powerScalar(base, T));
}
