// Attribute → stat scaling, made CLASS-AWARE.
//
// This is the single hand-tunable source of truth for how each of the five
// attributes converts into the hero's derived stats, and for the Spirit-boosted
// Spirit Veil shield + Spirit-scaled healing. Pure data: no logic, no imports. The
// pure lookup helpers live in src/systems/attributeScaling.js; the legacy shell
// reads them through a thin `attrCoef()` adapter.
//
// Design summary (why the numbers look like this):
//   • Damage rides TWO lanes. BASIC (auto) attacks scale off MIGHT for every class
//     (the `basicDmg` channel below) — Might is the universal weapon-power stat.
//     SKILLS/spells scale off the class's IDENTITY attribute (its dmg attr) — that's
//     the class's signature lane. Spells specifically live on Spirit + Spell Power.
//   • Every attribute→stat channel is scaled per class along a shared 4-rank
//     "ladder": the class ranked #1 for a channel gets the most per point, #4
//     the least. Rank #2 sits at the historical global value, so the tuned
//     difficulty curve is preserved for the class that mains a stat.
//   • Re-homed roles vs the old design: Might drives DEFENSE, ACCURACY and now BASIC
//     ATTACK DAMAGE (Accuracy moved off Agility, so Agility is pure nimbleness —
//     Evasion, move & attack speed). Vitality drives HP + STAMINA; Spirit scales
//     spells + HEALS + Veil; Luck is unchanged (crit + loot).

// ── Identity attribute per class — what SKILLS/spells scale off ──────────────
// (Basic auto-attacks scale off Might for everyone; see the `basicDmg` channel.)
export const CLASS_DMG_ATTR = {
  warrior:     'might',
  rogue:       'agility',
  mage:        'spirit',
  templar:     'vitality',
  fortune:     'luck',      // the only class that turns Luck into raw skill power
  windblade:   'agility',   // hybrid — see CLASS_DMG_ATTR2
  bloodletter: 'might',     // hybrid — see CLASS_DMG_ATTR2
};
// Classless legacy saves (mid-migration) fall back to this.
export const CLASS_DMG_ATTR_FALLBACK = 'might';

// ── HYBRID classes — skills scale off the SUM of TWO attributes ──────────────
// A pure class converts ONE identity attribute at ATTR_DMG_PER_POINT. A hybrid
// converts BOTH of its attributes at the lower ATTR_DMG_PER_POINT_HYBRID, applied
// to their SUM — so splitting points costs raw skill power versus a pure class,
// but buys the full derived-stat payout of two attributes (a Bloodletter's Vitality
// is HP *and* damage; a Windblade's Spirit is MP/Veil *and* damage). Summing rather
// than ranking the two also means there is no "dump the off-attribute" skew: a point
// in either one is worth exactly the same to the skill lane.
export const CLASS_DMG_ATTR2 = {
  windblade:   'spirit',
  bloodletter: 'vitality',
};

// Attack power added per point of the class's IDENTITY attribute to its SKILLS. Was a
// 2.4 primary + 0.8 secondary split; folded into one channel with a small bump so a
// hero who mains their identity attribute lands close to the old primary+secondary total.
export const ATTR_DMG_PER_POINT = 2.6;
// Per-point rate for the BASIC (auto) attack lane at the class that converts Might
// best. Deliberately ABOVE the skill rate: an active spends a cooldown and is amped
// again by Skill Power, while the auto-attack has neither, so pinning the two lanes
// to the same number left an auto-only build permanently behind. This is the auto
// lane's own dial — raising it never touches skills or spells.
export const ATTR_DMG_PER_POINT_BASIC = 2.95;
// Per-point rate for a HYBRID class, charged against BOTH attributes. Lower than the
// pure rate so a hybrid trades peak skill damage for breadth; the class-level damage
// multiplier (CLASS_DMG_DEALT in the shell) pays part of that gap back.
export const ATTR_DMG_PER_POINT_HYBRID = 2.0;

// ── The shared per-class scaling ladder ──────────────────────────────────────
// Multiplier applied to a channel's base coefficient, indexed by the class's
// rank in that channel's ordering. "Moderate" spread: clear identity, off-role
// attributes still pay out. Rank #2 == 1.0 (== the old global value) so the class
// that mains a stat keeps ~today's numbers (curve-preserving). Tune the whole
// game's class-identity strength from this one array.
//
// SEVEN ranks since the three new classes landed. The four original classes were
// NOT re-tuned: every `order` array below keeps them at ranks #1/#2/#4/#6, whose
// ladder values are exactly the old four (1.20 / 1.00 / 0.78 / 0.55). The three new
// classes INTERLEAVE at #3/#5/#7, so adding them shifted no existing coefficient by
// a single point. The trade is that a new class tops out at rank #3 (0.88) in any one
// channel — its identity comes from its damage attribute, tree and class multipliers
// rather than from out-scaling an original class on a derived stat.
//            #1     #2     #3     #4     #5     #6     #7
export const CLASS_SCALE_LADDER = [1.20, 1.00, 0.88, 0.78, 0.66, 0.55, 0.46];

// ── Attribute → stat channels ────────────────────────────────────────────────
// For each derived-stat channel: which attribute feeds it, the base (rank-#2)
// coefficient (the historical global value unless noted), and the class ordering
// best→worst. channelCoef(channel, class) = base × CLASS_SCALE_LADDER[rank].
//
// `base` units match the old ATTR_FX fields exactly, so swapping ATTR_FX.<x> for
// channelCoef('<channel>') is behaviour-identical for a rank-#2 class.
export const ATTR_STAT_CHANNELS = {
  // Might → BASIC (auto) attack damage — the universal weapon-power lane every class
  // swings off. Class-ranked warrior > rogue > templar > mage (mages rarely auto).
  // `base` is set so the top class (rank #1) lands at exactly ATTR_DMG_PER_POINT_BASIC,
  // which runs a little hotter than the skill lane's per-point rate on purpose — an
  // auto-attack pays no cooldown but also gets no Skill Power, so matching the two
  // rates left auto-only builds behind. (Skills still scale off the class's identity
  // attr at ATTR_DMG_PER_POINT.)
  basicDmg:     { attr: 'might',    base: ATTR_DMG_PER_POINT_BASIC / CLASS_SCALE_LADDER[0], order: ['warrior', 'rogue', 'bloodletter', 'templar', 'windblade', 'mage', 'fortune'] },

  // Might → Defense (moved off Vitality). Warriors armour up hardest.
  def:          { attr: 'might',    base: 0.5,   order: ['warrior', 'templar', 'bloodletter', 'rogue', 'windblade', 'mage', 'fortune'] },

  // Might → Accuracy (moved off Agility — Might is now the whole "land your weapon
  // swing" stat: how hard AND how true). Rogues convert it most efficiently.
  accuracy:     { attr: 'might',    base: 2.0,   order: ['rogue', 'warrior', 'fortune', 'templar', 'windblade', 'mage', 'bloodletter'] },

  // Vitality → HP & HP regen. Templars are the hardiest.
  hp:           { attr: 'vitality', base: 11,    order: ['templar', 'warrior', 'bloodletter', 'rogue', 'windblade', 'mage', 'fortune'] },
  hpRegen:      { attr: 'vitality', base: 0.06,  order: ['templar', 'warrior', 'bloodletter', 'rogue', 'windblade', 'mage', 'fortune'] },

  // Vitality → Stamina pool & recharge (moved off Might). Warriors sprint longest.
  staminaMax:   { attr: 'vitality', base: 1.6,   order: ['warrior', 'rogue', 'windblade', 'templar', 'bloodletter', 'mage', 'fortune'] },
  staminaRegen: { attr: 'vitality', base: 0.22,  order: ['warrior', 'rogue', 'windblade', 'templar', 'bloodletter', 'mage', 'fortune'] },

  // Agility → Evasion (rogues dodge best; mages surprisingly nimble).
  evasion:      { attr: 'agility',  base: 1.15,  order: ['rogue', 'mage', 'windblade', 'warrior', 'fortune', 'templar', 'bloodletter'] },
  // Agility → Move speed / Attack speed (rogues quickest overall). Accuracy moved to
  // Might, so Agility is now pure nimbleness — evasion + how fast you move & swing.
  // Move/attack speed are soft-capped curves; `base` is the CAP, class-scaled.
  moveCap:      { attr: 'agility',  base: 0.35,  order: ['rogue', 'warrior', 'windblade', 'templar', 'fortune', 'mage', 'bloodletter'] },
  atkSpdCap:    { attr: 'agility',  base: 60,    order: ['rogue', 'warrior', 'windblade', 'templar', 'fortune', 'mage', 'bloodletter'] },

  // Spirit → MP / MP regen / Spell power / Heals (mages hardest, warriors least).
  // The Bloodletter sits last in every Spirit channel by design — it has NO mana pool
  // at all (see CLASS_NO_MANA in the shell), so these coefficients never pay it out.
  mp:           { attr: 'spirit',   base: 4,     order: ['mage', 'templar', 'windblade', 'rogue', 'fortune', 'warrior', 'bloodletter'] },
  mpRegen:      { attr: 'spirit',   base: 0.025, order: ['mage', 'templar', 'windblade', 'rogue', 'fortune', 'warrior', 'bloodletter'] },
  spellPower:   { attr: 'spirit',   base: 3,     order: ['mage', 'templar', 'windblade', 'rogue', 'fortune', 'warrior', 'bloodletter'] },
  // Heals: new Spirit channel. Base per-point is modest so high Spirit + cooldown
  // reduction ramps sustain without instantly trivialising it (heals are still
  // gated by their cooldown and clamped to missing HP).
  heal:         { attr: 'spirit',   base: 0.9,   order: ['mage', 'templar', 'windblade', 'rogue', 'fortune', 'warrior', 'bloodletter'] },
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
  // → 2 / 1.5 / 1.3 / 1.1 / 0.9 / 0.75 / 0.6 %/pt. The Bloodletter amplifies Veil least:
  // it pays for skills in HP, so a big Spirit buffer would undercut its whole risk loop.
  classMult:   { mage: 1.0, templar: 0.75, windblade: 0.65, rogue: 0.55, fortune: 0.45, warrior: 0.375, bloodletter: 0.3 },
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
