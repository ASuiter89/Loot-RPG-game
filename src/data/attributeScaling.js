// Attribute → stat scaling, made CLASS-AWARE.
//
// This is the single hand-tunable source of truth for how each of the five
// attributes converts into the hero's derived stats, and for the Spirit-boosted
// Spirit Veil shield + Spirit-scaled healing. Pure data: no logic, no imports. The
// pure lookup helpers live in src/systems/attributeScaling.js; the legacy shell
// reads them through a thin `attrCoef()` adapter.
//
// Design summary (why the numbers look like this):
//   • Each class deals weapon/skill damage off ONE attribute (its dmg attr) —
//     no more primary+secondary split, no universal Might dab.
//   • Every attribute→stat channel is scaled per class along a shared 4-rank
//     "ladder": the class ranked #1 for a channel gets the most per point, #4
//     the least. Rank #2 sits at the historical global value, so the tuned
//     difficulty curve is preserved for the class that mains a stat.
//   • Re-homed roles vs the old design: Might now drives DEFENSE (was Vitality);
//     Vitality now also drives STAMINA (was Might); Spirit now also scales HEALS.
//     Agility and Luck are unchanged in role.

// ── Damage attribute per class (single attribute, no secondary) ──────────────
export const CLASS_DMG_ATTR = {
  warrior: 'might',
  rogue:   'agility',
  mage:    'spirit',
  templar: 'vitality',
};
// Classless legacy saves (mid-migration) fall back to this.
export const CLASS_DMG_ATTR_FALLBACK = 'might';

// Attack power added per point of the class's damage attribute. Was a 2.4 primary
// + 0.8 secondary split; folded into one channel with a small bump so a hero who
// mains their damage attribute lands close to the old primary+secondary total.
export const ATTR_DMG_PER_POINT = 2.6;

// ── The shared per-class scaling ladder ──────────────────────────────────────
// Multiplier applied to a channel's base coefficient, indexed by the class's
// rank in that channel's ordering. "Moderate" spread: clear identity, off-role
// attributes still pay out. Rank #2 == 1.0 (== the old global value) so the class
// that mains a stat keeps ~today's numbers (curve-preserving). Tune the whole
// game's class-identity strength from this one array.
//            #1     #2     #3     #4
export const CLASS_SCALE_LADDER = [1.20, 1.00, 0.78, 0.55];

// ── Attribute → stat channels ────────────────────────────────────────────────
// For each derived-stat channel: which attribute feeds it, the base (rank-#2)
// coefficient (the historical global value unless noted), and the class ordering
// best→worst. channelCoef(channel, class) = base × CLASS_SCALE_LADDER[rank].
//
// `base` units match the old ATTR_FX fields exactly, so swapping ATTR_FX.<x> for
// channelCoef('<channel>') is behaviour-identical for a rank-#2 class.
export const ATTR_STAT_CHANNELS = {
  // Might → Defense (moved off Vitality). Warriors armour up hardest.
  def:          { attr: 'might',    base: 0.5,   order: ['warrior', 'templar', 'rogue', 'mage'] },

  // Vitality → HP & HP regen. Templars are the hardiest.
  hp:           { attr: 'vitality', base: 11,    order: ['templar', 'warrior', 'rogue', 'mage'] },
  hpRegen:      { attr: 'vitality', base: 0.06,  order: ['templar', 'warrior', 'rogue', 'mage'] },

  // Vitality → Stamina pool & recharge (moved off Might). Warriors sprint longest.
  staminaMax:   { attr: 'vitality', base: 1.6,   order: ['warrior', 'rogue', 'templar', 'mage'] },
  staminaRegen: { attr: 'vitality', base: 0.22,  order: ['warrior', 'rogue', 'templar', 'mage'] },

  // Agility → Evasion (rogues dodge best; mages surprisingly nimble).
  evasion:      { attr: 'agility',  base: 1.15,  order: ['rogue', 'mage', 'warrior', 'templar'] },
  // Agility → Accuracy / Move speed / Attack speed (rogues quickest overall).
  accuracy:     { attr: 'agility',  base: 2.0,   order: ['rogue', 'warrior', 'templar', 'mage'] },
  // Move/attack speed are soft-capped curves; `base` is the CAP, class-scaled.
  moveCap:      { attr: 'agility',  base: 0.35,  order: ['rogue', 'warrior', 'templar', 'mage'] },
  atkSpdCap:    { attr: 'agility',  base: 60,    order: ['rogue', 'warrior', 'templar', 'mage'] },

  // Spirit → MP / MP regen / Spell power / Heals (mages hardest, warriors least).
  mp:           { attr: 'spirit',   base: 4,     order: ['mage', 'templar', 'rogue', 'warrior'] },
  mpRegen:      { attr: 'spirit',   base: 0.025, order: ['mage', 'templar', 'rogue', 'warrior'] },
  spellPower:   { attr: 'spirit',   base: 3,     order: ['mage', 'templar', 'rogue', 'warrior'] },
  // Heals: new Spirit channel. Base per-point is modest so high Spirit + cooldown
  // reduction ramps sustain without instantly trivialising it (heals are still
  // gated by their cooldown and clamped to missing HP).
  heal:         { attr: 'spirit',   base: 0.9,   order: ['mage', 'templar', 'rogue', 'warrior'] },
};

// Luck is deliberately class-flat (crit rating, loot quality). Kept here so the
// full attribute picture lives in one file, but NOT run through the ladder.
export const LUCK_FX = {
  critPerLuck: 0.85,   // Luck → crit rating per point (unchanged, all classes)
};

// ── Spirit Veil — the persistent Spirit shield ("Mana Shield"-style energy pool) ──
// A blue over-HP buffer that soaks damage before health and recharges after a
// clean, damage-free window. Nothing else refills it (no potions/skills).
//
// The Veil pool comes ONLY from OTHER sources — the flat +Spirit Veil (VEIL) affix on
// gear and shield-granting spells/buffs. Spirit itself no longer grants a flat pool
// (a fresh hero with no VEIL gear has NO Veil, and none appears on the HUD). Instead
// Spirit BOOSTS whatever Veil those sources give: each point above the baseline adds a
// class-scaled % to the max, SEPARATELY from HP and with NO HP-relative cap. The boost
// is class-ranked Mage > Templar > Rogue > Warrior, so a caster who both stacks VEIL
// gear and invests Spirit can end up with a Veil larger than their health, while a
// Warrior barely amplifies what little Veil they carry.
export const SHIELD = {
  // Fractional boost to max Spirit Veil per point of Spirit ABOVE the baseline, for
  // the top class (Mage); other classes take a share via classMult below. e.g. a Mage
  // 50 Spirit over baseline → +100% max Veil (doubled); a Warrior → +37.5%.
  spiritBoostPerPoint: 0.02,
  classMult:   { mage: 1.0, templar: 0.75, rogue: 0.55, warrior: 0.375 }, // → 2 / 1.5 / 1.1 / 0.75 %/pt
  classMultDefault: 0.55, // classless fallback (mid of the range)
  rechargeDelay: 3.5,  // seconds without taking ANY damage before recharge starts
  baseRechargePct: 0.125, // fraction of max Spirit Veil restored per second (~8s to full)
  // Spirit speeds the recharge a little (class-scaled by classMult). Measured from
  // the starting Spirit baseline so a fresh hero sits at baseRechargePct.
  spiritBase: 10,      // == ATTR_BASE; the Veil boost & recharge speed-up count Spirit above this
  rechargePctPerSpirit: 0.0011,
  rechargeMaxPct: 0.30, // cap recharge at 30%/sec no matter how much Spirit
};

// Spirit-scaled healing (Mend / Sanctuary etc.) is applied by healAmount() in
// src/systems/attributeScaling.js using each skill's own flat/perLevel plus the
// class-scaled 'heal' channel above:
//   heal = (flat + level*perLevel + spirit*channelCoef('heal')) * rankScale * spellPowerMult
// The old flat 20%-of-max-HP cap is gone (still clamped to missing HP) — Spirit is
// the sustain investment. Tune growth via the 'heal' channel base above.
