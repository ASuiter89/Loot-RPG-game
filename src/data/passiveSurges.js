// ── PASSIVE SURGES ───────────────────────────────────────────────────────────
// A "surge" is the reward for MAXING a base-tree passive: at rank 10 the node
// grants ONE extra, distinct stat it never gave before — a genuinely new stat,
// not just more of what it already scaled. It fires once (flat, at max rank), on
// top of the node's normal per-rank fx. The chosen stat is thematically tied to
// the passive (a crit node surges into crit damage, an HP node into regen, …).
//
// Keyed by node id. ONLY base-tree, non-keystone passives get a surge (keystones
// are single-rank build-definers with unique mechanics already; ascendancy nodes
// are left alone). skillBonus() folds a live surge into the SAME bonus keys the
// combat formulas already read, so no new combat hooks are needed — see
// passiveSurgeLive() in systems/skillMath.js for the max-rank gate.
//
// Each stat's surge magnitude is standardised here so the whole set balances as a
// group; each entry just names the ONE new stat that passive surges into.

// Standard surge magnitude per stat — one flat grant applied once at max rank.
// Roughly a few extra ranks' worth of a complementary stat, in a NEW dimension.
const SURGE_MAG = {
  crit: 0.03,        // +3% crit chance
  critDmg: 0.20,     // +20% crit damage
  dmgDealt: 0.05,    // +5% damage
  dmgTaken: 0.05,    // −5% damage taken (positive = reduction)
  dr: 2.5,           // +2.5% flat damage reduction
  block: 3,          // +3% block chance
  reflect: 0.12,     // reflect +12% of melee
  pen: 0.06,         // +6% armor penetration
  dodge: 0.04,       // +4% dodge
  lifesteal: 0.03,   // +3% lifesteal
  hpRegen: 3,        // +3 HP regen
  mpRegen: 2,        // +2 MP regen
  maxHpPct: 0.08,    // +8% max HP
  maxMpPct: 0.10,    // +10% max MP
  spell: 0.12,       // +12% spell power
  lowHpDmg: 0.10,    // +10% damage vs wounded foes
};

// A surge grants exactly ONE new stat: s('crit') → { crit: 0.03 }.
const s = (key) => ({ [key]: SURGE_MAG[key] });

export const PASSIVE_SURGES = {
  // ── Warrior ──────────────────────────────────────────────────────────────
  w_p00: s('hpRegen'),   // Toughened — thick hide knits wounds
  w_p01: s('lifesteal'), // Bloodscent — the scent of blood becomes a thirst
  w_p02: s('pen'),       // Heavy Hands — heavy blows crush through armor
  w_p03: s('critDmg'),   // Keen Eye — a keen eye finds the killing spot
  w_p04: s('dr'),        // Shield Guard — a raised guard turns blows aside
  w_p10: s('maxHpPct'),  // Iron Skin — tougher hide, more to give
  w_p11: s('crit'),      // Rampage — a frenzied swing finds openings
  w_p12: s('pen'),       // Cleaving Force — wide cleaves shear armor
  w_p13: s('crit'),      // Tempered Fury — tempered strikes bite true
  w_p14: s('block'),     // Bulwark Stance — a braced stance blocks more
  w_p20: s('maxHpPct'),  // Last Wind — a deeper reserve to draw on
  w_p21: s('lowHpDmg'),  // Blood Frenzy — wounded, the frenzy sharpens
  w_p22: s('pen'),       // Brutality — brutal force splits plate
  w_p23: s('critDmg'),   // Ruthless — the wounded are finished harder
  w_p24: s('dr'),        // Spite — spite hardens against the next blow
  w_p30: s('dmgTaken'),  // Juggernaut — unstoppable, barely slowed
  w_p31: s('hpRegen'),   // Unquenchable — an endless second wind
  w_p32: s('critDmg'),   // Crushing Blows — crushing hits maim
  w_p33: s('dmgDealt'),  // Battle Trance — the trance lends raw power
  w_p34: s('reflect'),   // Aegis Training — a trained aegis bites back
  w_p40: s('dr'),        // Immovable — an immovable wall shrugs off harm
  w_p41: s('lifesteal'), // Carnage — carnage feeds the blade
  w_p42: s('crit'),      // Titanic Might — titanic swings land clean
  w_p43: s('critDmg'),   // Killing Spree — a spree hits ever deadlier
  w_p44: s('maxHpPct'),  // Shield Wall — the wall holds far more

  // ── Rogue ────────────────────────────────────────────────────────────────
  r_p00: s('critDmg'),   // Killer Instinct — instinct guides the killing cut
  r_p01: s('dodge'),     // Finesse — finesse becomes footwork
  r_p02: s('dmgTaken'),  // Evasion — glancing blows barely graze
  r_p03: s('pen'),       // Venom — venom eats through armor
  r_p04: s('crit'),      // Precision — precision finds the weak point
  r_p10: s('crit'),      // Deadly Strikes — deadly aim lands more often
  r_p11: s('critDmg'),   // Opportunist — the opening is a vital
  r_p12: s('dmgDealt'),  // Fleet Footed — footwork opens the attack
  r_p13: s('pen'),       // Virulent Toxins — toxins rot through plate
  r_p14: s('critDmg'),   // Steady Aim — a steady aim strikes vitals
  r_p20: s('crit'),      // Savagery — savage blows crit more
  r_p21: s('critDmg'),   // Duelist's Edge — a duelist's edge finds the heart
  r_p22: s('critDmg'),   // Cloak of Shadows — an ambush from the dark
  r_p23: s('critDmg'),   // Corrosion — corroded armor gives no cover
  r_p24: s('critDmg'),   // Expose Weakness — the exposed foe is cut deep
  r_p30: s('lifesteal'), // Bloodthirst — bloodthirst drinks each kill
  r_p31: s('critDmg'),   // Bloodletter — bled foes bleed harder on a crit
  r_p32: s('dmgTaken'),  // Untouchable — untouchable, blows slide off
  r_p33: s('pen'),       // Plaguebearer — plague seeps past armor
  r_p34: s('crit'),      // Deadeye — a deadeye rarely misses the mark
  r_p40: s('pen'),       // Assassinate — the assassin ignores armor
  r_p41: s('dmgDealt'),  // Butcher — the butcher hits harder
  r_p42: s('critDmg'),   // Phantom — a phantom strike hits the vital
  r_p43: s('pen'),       // Venomlord — potent venom bypasses plate
  r_p44: s('critDmg'),   // Sharpshooter — a sharpshooter aims for the kill

  // ── Mage ─────────────────────────────────────────────────────────────────
  m_p00: s('crit'),      // Kindling — kindled flame sparks spell crits
  m_p01: s('dmgTaken'),  // Frost Touch — frost armor blunts blows
  m_p02: s('crit'),      // Static Charge — charged spells crit more
  m_p03: s('maxMpPct'),  // Arcane Study — deeper study, deeper mana
  m_p04: s('maxMpPct'),  // Mana Skin — a broader well to shield with
  m_p10: s('pen'),       // Smoldering — smolder burns through resistance
  m_p11: s('maxHpPct'),  // Cold Bones — cold bones endure more
  m_p12: s('critDmg'),   // Conduction — conducted power hits harder
  m_p13: s('mpRegen'),   // Mana Pool — the pool refills faster
  m_p14: s('maxHpPct'),  // Insulation — insulation hardens the body
  m_p20: s('crit'),      // Combustion — combustion flares into crits
  m_p21: s('pen'),       // Permafrost — permafrost pierces cold defenses
  m_p22: s('critDmg'),   // Arc Lightning — arcs strike with force
  m_p23: s('spell'),     // Arcane Surge — the surge overflows into raw spell
  m_p24: s('spell'),     // Mana Font — abundant mana fuels stronger spells
  m_p30: s('crit'),      // Conflagration — the blaze finds the weak point
  m_p31: s('reflect'),   // Glacial Armor — glacial spikes bite attackers
  m_p32: s('crit'),      // Overcharge — overcharge sparks more crits
  m_p33: s('critDmg'),   // Arcane Power — arcane power lands crushing crits
  m_p34: s('dmgTaken'),  // Reflective Ward — the ward absorbs some blows
  m_p40: s('crit'),      // Living Flame — living flame flickers into crits
  m_p41: s('spell'),     // Deep Freeze — deep cold empowers the spell
  m_p42: s('critDmg'),   // Tesla Field — the field discharges hard
  m_p43: s('pen'),       // Spell Weave — woven spells slip past wards
  m_p44: s('maxHpPct'),  // Greater Ward — the greater ward steels the body

  // ── Templar ──────────────────────────────────────────────────────────────
  t_p00: s('crit'),      // Zealous Heart — zeal sharpens the strike
  t_p01: s('dr'),        // Faithful Guard — a faithful guard endures
  t_p02: s('dr'),        // Thornskin — thorned skin turns blows aside
  t_p03: s('maxHpPct'),  // Devotion — devotion steels the body
  t_p04: s('pen'),       // Smiter — a smite pierces the profane
  t_p10: s('crit'),      // Righteous Fury — righteous fury strikes true
  t_p11: s('block'),     // Stalwart — a stalwart brace blocks more
  t_p12: s('dr'),        // Vengeful Spirit — a vengeful spirit hardens
  t_p13: s('maxHpPct'),  // Almsgiver — charity fortifies the giver
  t_p14: s('pen'),       // Condemnation — condemnation pierces defenses
  t_p20: s('critDmg'),   // Holy Zeal — holy zeal smites deep
  t_p21: s('block'),     // Bulwark — the bulwark turns more aside
  t_p22: s('dr'),        // Retaliation — retaliation braces the body
  t_p23: s('dmgTaken'),  // Sanctity — sanctity wards off harm
  t_p24: s('crit'),      // Divine Wrath — divine wrath finds the vital
  t_p30: s('lifesteal'), // Crusader's Wrath — the crusade drinks the fallen
  t_p31: s('maxHpPct'),  // Unyielding — an unyielding frame holds more
  t_p32: s('critDmg'),   // Avenger — the avenger's blow lands deep
  t_p33: s('maxMpPct'),  // Lifebond — the bond deepens the mana well
  t_p34: s('critDmg'),   // Radiance — radiant strikes burn deeper
  t_p40: s('critDmg'),   // Zealot's Fervor — fervor lends a killing edge
  t_p41: s('reflect'),   // Aegis Mastery — a mastered aegis smites back
  t_p42: s('dr'),        // Reckoning — the reckoning hardens the martyr
  t_p43: s('maxHpPct'),  // Seraph — a seraph's grace fortifies
  t_p44: s('crit'),      // Paragon — a paragon's strike finds the mark
};
