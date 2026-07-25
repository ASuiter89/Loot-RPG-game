// Shrine catalog — every Shrine (*) kind the dungeon can spawn, as pure data.
//
// A shrine is either a multi-floor BOON (counts down in the shell's `buffs` map)
// or an INSTANT effect (blood/wisdom, applied once). Boon magnitudes live in `fx`
// and fold into the live combat formulas through shrineFx() — one additive term
// next to the matching foodFx/healerFx term, so a shrine boon behaves like a
// temporary food/blessing buff that lapses per floor.
//
// Fields:
//   name    display name (status strip, gameState, tooltips)
//   icon    atlas sprite key (SPRITE_IDX in src/legacy/game.js) — real pixel art
//   flash   screenFlash colour on activation (a VFX colour, not a UI token)
//   tint    colour of the terse floating label that pops over the hero on contact
//           (shrineShortName(name), e.g. "Fortune"). A VFX colour, not a token —
//           every kind gets a DISTINCT shade drawn from the loot-rarity spectrum
//           (grey→green→blue→purple→orange→red) so the pop reads at a glance.
//   desc    one-line tooltip / STATUS_META description
//   weight  spawn weight for the weighted pick (classics common, new ones rarer)
//   floors  boon duration in floors (omit for instant shrines)
//   fx      { effectKey: magnitude } summed live by shrineFx(); see the hook sites
//   log     the activation log line (boons; instants log bespoke text in the shell)
//   classic mechanics are special-cased in activateShrine (no generic `fx` wiring)
//   instant applied once on contact — never enters the `buffs` map
//   stamina one-shot on-grant: tops Stamina to full (Vigor)
//
// fx keys and where each is read (all live functions that already sum foodFx):
//   goldPct       kill-gold multiplier (+fraction)         insight/greed
//   xpPct         kill-xp multiplier (+fraction)
//   magicPct      qualityMagicFind (×100 → Magic Find points)
//   matPct        material-drop multiplier (+fraction)
//   critPct       crit rating (via ratePct)
//   dodgePct      evasion rating (via ratePct)
//   spellUp       spell-power multiplier (+fraction)
//   skillUp       skill-power multiplier (+fraction)
//   lifesteal     life-leech rate (+fraction)
//   thornsLvl     flat thorns reflect per dungeon level
//   regenPctHp    HP regen per beat as a fraction of max HP
//   mpRegenPctMp  MP regen per beat as a fraction of max MP
//   defLvl        flat Defense per dungeon level
//   movePct       move-speed multiplier (+fraction)
//   atkSpdPct     attack-speed points (×100)
export const SHRINE_DEFS = {
  // ── Classic boons — mechanics special-cased in activateShrine() ──
  power:   { name: 'Shrine of Power',   icon: 'ui_power', flash: '#ff6600', tint: '#ff6a2c', floors: 3, weight: 5, classic: true,
             desc: '+50% damage.',                 log: 'Shrine of Power! +50% damage for 3 floors.' },
  guard:   { name: 'Shrine of Warding', icon: 'a_shield', flash: '#3366ff', tint: '#5c9bd6', floors: 3, weight: 5, classic: true,
             desc: 'Take 40% less damage.',         log: 'Shrine of Warding! Incoming damage −40% for 3 floors.' },
  fortune: { name: 'Shrine of Fortune', icon: 'ic_money', flash: '#22cc66', tint: '#44bb44', floors: 3, weight: 5, classic: true,
             desc: '+50% loot and an extra drop.',  log: 'Shrine of Fortune! Better loot for 3 floors.' },
  blood:   { name: 'Blood Shrine',      icon: 'ic_heart', flash: '#cc0000', tint: '#ff2222', weight: 4, classic: true, instant: true,
             desc: 'Trade current HP for a burst of XP.' },
  wisdom:  { name: 'Shrine of Wisdom',  icon: 'scroll',   flash: '#aa66ff', tint: '#c98bff', weight: 4, classic: true, instant: true,
             desc: 'Restores HP and refills MP.' },

  // ── New boons — generic buff pipeline via shrineFx() ──
  greed:     { name: 'Shrine of Greed',      icon: 'ic_coffer',  flash: '#ffcf52', tint: '#ffcf52', floors: 3, weight: 1, fx: { goldPct: 0.6 },
               desc: '+60% gold found.',            log: 'Shrine of Greed! +60% gold for 3 floors.' },
  insight:   { name: 'Shrine of Insight',    icon: 'ui_level',   flash: '#6ec1ff', tint: '#6ec1ff', floors: 3, weight: 1, fx: { xpPct: 0.5 },
               desc: '+50% experience gained.',     log: 'Shrine of Insight! +50% XP for 3 floors.' },
  discovery: { name: 'Shrine of Discovery',  icon: 'mat_glimmer', flash: '#d78bff', tint: '#d78bff', floors: 3, weight: 1, fx: { magicPct: 0.5 },
               desc: '+50 Magic Find (rarer drops).', log: 'Shrine of Discovery! +50 Magic Find for 3 floors.' },
  harvest:   { name: 'Shrine of Harvest',    icon: 'mat_core',   flash: '#8fd694', tint: '#8fd694', floors: 3, weight: 1, fx: { matPct: 0.6 },
               desc: '+60% crafting materials.',    log: 'Shrine of Harvest! +60% materials for 3 floors.' },
  precision: { name: 'Shrine of Precision',  icon: 'ic_target',  flash: '#ff9a3c', tint: '#ff9a3c', floors: 3, weight: 1, fx: { critPct: 0.18 },
               desc: '+18% critical-hit chance.',   log: 'Shrine of Precision! +18% crit for 3 floors.' },
  phantom:   { name: 'Shrine of the Phantom', icon: 'a_hands',   flash: '#9fb4d6', tint: '#9fb4d6', floors: 3, weight: 1, fx: { dodgePct: 0.15 },
               desc: '+15% chance to dodge.',       log: 'Shrine of the Phantom! +15% dodge for 3 floors.' },
  sorcery:   { name: 'Shrine of Sorcery',    icon: 'ic_wand',    flash: '#b08ad8', tint: '#aa44ff', floors: 3, weight: 1, fx: { spellUp: 0.3, skillUp: 0.3 },
               desc: '+30% skill & spell power.',   log: 'Shrine of Sorcery! +30% ability power for 3 floors.' },
  leech:     { name: 'Shrine of the Leech',  icon: 'ic_cursed',  flash: '#cc3355', tint: '#dd4466', floors: 3, weight: 1, fx: { lifesteal: 0.15 },
               desc: 'Heal for 15% of damage dealt.', log: 'Shrine of the Leech! +15% lifesteal for 3 floors.' },
  thorns:    { name: 'Shrine of Brambles',   icon: 'ic_mallet',  flash: '#7fae5f', tint: '#6faf4f', floors: 3, weight: 1, fx: { thornsLvl: 4 },
               desc: 'Reflect damage at attackers.', log: 'Shrine of Brambles! Reflect damage for 3 floors.' },
  renewal:   { name: 'Shrine of Renewal',    icon: 'ic_heart',   flash: '#55dd77', tint: '#55dd77', floors: 3, weight: 1, fx: { regenPctHp: 0.01 },
               desc: 'Steadily regenerate HP.',     log: 'Shrine of Renewal! Regenerate HP for 3 floors.' },
  clarity:   { name: 'Shrine of Clarity',    icon: 'ic_orb',     flash: '#59b6ff', tint: '#40c4ff', floors: 3, weight: 1, fx: { mpRegenPctMp: 0.02 },
               desc: 'Steadily regenerate MP.',     log: 'Shrine of Clarity! Regenerate MP for 3 floors.' },
  bulwark:   { name: 'Shrine of the Bulwark', icon: 'a_chest',   flash: '#6688cc', tint: '#6688cc', floors: 3, weight: 1, fx: { defLvl: 2 },
               desc: 'Bolstered Defense.',          log: 'Shrine of the Bulwark! +Defense for 3 floors.' },
  swift:     { name: 'Shrine of Swiftness',  icon: 'ui_agility', flash: '#7fe0d0', tint: '#2fd6c0', floors: 3, weight: 1, fx: { movePct: 0.18 },
               desc: '+18% move speed.',            log: 'Shrine of Swiftness! +18% move speed for 3 floors.' },
  haste:     { name: 'Shrine of Haste',      icon: 'w_dagger',   flash: '#ffd24b', tint: '#ff8800', floors: 3, weight: 1, fx: { atkSpdPct: 0.25 },
               desc: '+25% attack speed.',          log: 'Shrine of Haste! +25% attack speed for 3 floors.' },
  vigor:     { name: 'Shrine of Vigor',      icon: 'potion_g',   flash: '#ffb14a', tint: '#ffb14a', floors: 3, weight: 1, stamina: true, fx: {},
               desc: 'Tireless sprint & dash; Stamina refilled.', log: 'Shrine of Vigor! Tireless sprint & dash for 3 floors.' },
};
