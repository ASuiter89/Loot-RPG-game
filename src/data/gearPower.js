// Gear-Power tuning — pure values, read by src/systems/gearPower.js.
//
// "Power" is a single number summarising how much an item (or the whole hero)
// contributes to combat. It used to be a near-static weighted sum of an item's
// raw stats (class-adjusted at best), so a Crit Damage roll was worth the same
// Power whether the hero critted 40% of the time or never — and "better" gear
// could read as LOWER Power for a build that couldn't use its stats. This model
// replaces that: an item's Power is the marginal gain in an effective COMBAT
// SCORE (a blend of effective offense and survivability, built from the real
// combat formulas) that the item's affixes give THIS hero's current build. A
// stat that does nothing for you — Crit Damage with no crit, Spell Power on a
// pure martial build, Attack Speed on a caster — now adds ~0 Power, exactly as
// it should.
//
// combatScore(ctx) = wOff · (offense / offRef) + wDef · (survivability / defRef)
// with all the build-awareness living inside the two nonlinear channels (crit
// expectation, hit/dodge/block/DR rating curves, the mitigation product, class
// reliance gating). itemPower = round(K · [score(build+item) − score(build)] +
// flat utility). Everything below is tuned so a fresh hero reads on the same
// ~100–300 scale as the old formula (leaderboard + "Rising Power" achievement
// stay meaningful) and Power grows monotonically with a real build.
export const GEAR_POWER = {
  // ── Global scale ──
  // Multiplies the compressed combat score into "Power points". Calibrated (see
  // test/systems/gearPower.test.js) so a fresh hero reads ~200 and the whole
  // level curve stays within roughly 1.5× of the old formula's numbers.
  K: 136,
  // Effective offense is a PRODUCT of multipliers, so raw combat score grows
  // faster than the old additive weighted sum — a stacked-synergy endgame build
  // could read many times the old Power and blow past the achievement tiers. A
  // concave exponent (< 1) on the score before scaling tames that compounding so
  // Power ≈ the old curve across the whole game, while every marginal stays
  // strictly monotone (an upgrade always raises it) and a no-op stat still adds 0.
  powerExp: 0.7,
  // Channel weights in the blend. Slightly offense-favoured — this is a game
  // about killing things — but close to balanced so a tank still reads powerful.
  wOff: 1.1,
  wDef: 0.9,
  // Reference channel outputs (a canonical fresh hero's offense/survivability),
  // so each normalized channel sits near 1.0 for a starting character and the
  // blend near wOff+wDef. Power above that is what your build/gear buys.
  offRef: 42,
  defRef: 210,
  // A tiny floor keeping every channel strictly positive (no divide-by-zero /
  // NaN for a naked, zero-stat, or zero-HP hero).
  eps: 1e-6,

  // ── Reference opposition (mirrors the monolith's rating-vs-level curves) ──
  // Power is a stable property of the build, so chances are evaluated against a
  // reference tied to the hero's LEVEL (not the live floor, which changes without
  // bumping the loadout cache). opp = base + level·perLvl.
  critOppBase: 34,  critOppPerLvl: 9,
  blockOppBase: 30, blockOppPerLvl: 9,
  drOppBase: 46,    drOppPerLvl: 12,
  enemyEvaBase: 6,  enemyEvaPerLvl: 3,
  // enemyAcc uses the monolith's 32 + level·enemyAccPerFloor; the live per-floor
  // rate defaults to ~9, so we bake a representative slope here for the dodge
  // reference (a normal, non-boss foe).
  enemyAccBase: 32, enemyAccPerLvl: 9,
  // CDR is rated against a fixed scale (matches CDR_SCALE in the monolith).
  cdrScale: 100,

  // ── Offense channel ──
  // Your damage comes half from never-miss actives (that Skill Power amps) and
  // half from auto-attacks (that can miss but Skill Power does not touch), so
  // Accuracy and Skill Power each pull real weight. Tuned to sum to 1.
  autoShare: 0.5,
  skillShare: 0.5,
  // A representative spell for the spell lane: base damage = spellFlat +
  // level·spellPerLvl + spirit·spellPerSpirit, then ×(1 + Spell Power%). Mirrors
  // spellBase(12, 2) with ATTR_FX.spellPerSpr = 3.
  spellFlat: 12, spellPerLvl: 2, spellPerSpirit: 3,
  // Cast/attack cadence baselines (casts or swings per second before haste). The
  // martial base is 1/(PLAYER_ATK_BASE·avgStyle); the spell base is a slower ~1
  // per 2s active. Only ratios matter (everything is normalized by offRef).
  attackRateBase: 0.75,
  castRateBase: 0.5,
  // Armor a representative foe at the reference level carries, and the pen scale
  // (armorPen = pen/(pen+penScale)); matches enemyArmorPct's mid value and
  // armorPenFrac's 0.5 knee.
  refArmorPct: 0.10,
  penScale: 0.5,
  // Situational offense stats are real but only fire in some fights, so they
  // count at a discount (fraction of their raw %). Boss damage only vs bosses,
  // Execute only on low-HP foes, Cleave only in packs, Bleed is a slow DoT.
  bossW: 0.2, execW: 0.25, cleaveW: 0.2, bleedW: 0.3, stunW: 0.15,

  // ── Survivability channel ──
  // Effective HP = maxHP / mitigation, where mitigation multiplies the class
  // damage-taken, dodge/DR avoidance, half-weight block, and armor mitigation.
  armorFlat: 18, armorPerLvl: 6,   // armorMit = def/(def + armorFlat + level·armorPerLvl)
  blockAmt: 0.5,                    // a block halves the blow
  // Mitigation can never round to zero (no free invulnerability), so EHP can't
  // blow up to infinity for a fully-stacked defensive build.
  minTaken: 0.05,
  // Minor survivability contributors, folded as small EHP multipliers/adds.
  regenW: 6,       // HP regen/sec → equivalent HP over a short fight window
  thornsW: 0.15,   // reflected damage, per THORNS%
  tenacW: 0.25,    // stun/slow resistance, per TENAC%
  // Life leech is sustain proportional to your DAMAGE output — worthless at 0
  // DPS, strong on a high-DPS build. Its EHP-equivalent = leech% · offense ·
  // leechToEhp. On-kill restores are a smaller flat sustain.
  leechToEhp: 4.0,
  onKillW: 3.0,

  // ── Flat utility (genuinely build-independent) ──
  // Find/XP/gold stats and mana pool/cost don't change your combat strength, so
  // they never scale with the build — but a pure-utility piece shouldn't read a
  // literal 0 Power either. They add a small FLAT Power per point, on top of the
  // combat-score delta. (These roughly preserve the old weights for these stats.)
  // (REGEN is NOT here — it feeds the survivability channel as a real EHP-over-time
  // contributor, so pricing it as flat utility too would double-count it.)
  utilityFlat: {
    GOLDFIND: 1, XPGAIN: 1, MAGICFIND: 2, MATFIND: 1,
    MCR: 1.5, MPLEECH: 1.2, MPKILL: 0.8, MP: 0.15,
  },
  // A small flat nudge per rarity — kept low so Power is driven by real stat
  // impact, letting a deep common eventually out-power an early legendary.
  tierBonus: { junk: 0, normal: 1, uncommon: 2, rare: 4, epic: 7, legendary: 11, unique: 16 },
};
