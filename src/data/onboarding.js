// ── ONBOARDING / RAMP-UP SCHEDULE ────────────────────────────────────────────
// The single source of truth for how the game eases a NEW hero into its mechanics
// instead of dumping everything on floor 1. Pure data — no logic, no DOM, no RNG.
// The decision helpers that read this live in src/systems/onboarding.js; the
// legacy monolith wires the effects (gating, hint chips, glows) by calling those.
//
// Two layers ride on this schedule:
//   • CONTENT PACING (universal) — what the dungeon itself hands out early: elite
//     affixes, hazards, gear requirements, cursed/set/unique loot, hotbar slots,
//     the second weapon loadout, a gentler opening difficulty. Gated on the
//     deepest floor REACHED (`maxFloor`), so — exactly like the rarity gate — a
//     deep save (high maxFloor) has every gate already open and is unaffected;
//     only a brand-new hero actually ramps.
//   • TEACHING (guided-only, `player.guided`) — the hand-holding: first-encounter
//     hint chips, tab/HUD reveals, level-up glows, keeper intros, the guided town
//     tour, death tips, the starter checklist. A returning player who picks
//     "Classic" at hero creation gets none of it (byte-identical to before);
//     existing saves are migrated to Classic so a veteran is never nagged.
//
// Floors 1–25 are Normal difficulty; 26–50 are Hardened. Per the design, the
// early mechanics stagger across Normal and the endgame-only systems (that a new
// player has no use for until much later) introduce themselves across Hardened.

// ── FEATURE GATES ────────────────────────────────────────────────────────────
// feature → the deepest-floor-reached at which it becomes fully available. Below
// its gate the feature is withheld (content pacing). Chosen to spread the reveals
// evenly across the first descent rather than clustering them on floor 1.
export const RAMP_FLOOR = {
  // Elite foes (and their tough/fierce/venomous… affixes) stay out of the opening
  // floors so the very first fights are readable. Elites begin on floor 4.
  elites: 4,
  // Gear requirements (attribute gates that render under-req items red) are lifted
  // on the opening floors so early equipping is frictionless "see it → wear it".
  gearReq: 5,
  // Loot KINDS stagger in one at a time after the basic affix game is learned.
  setItems: 8,
  // Gates the whole SPECIAL-ITEM family (cursed / fortunate / deepforged / storied) —
  // they arrive together as "gear with a twist". Key kept as-is so saves still read.
  cursedItems: 10,
  uniqueItems: 12,
  // The second weapon loadout (and its swap button) is introduced on floor 20 —
  // one gear set to master first.
  loadoutSwap: 20,
  // Below this floor, tooltips run in a trimmed "beginner" form (no DPS-vs-depth
  // pill, no rating-math lines); from floor 10 the full detail returns.
  detailedTooltips: 10,
  // Foes carry negligible typed defence (armor / magic resist) until this floor,
  // so a new hero's "wrong" damage school never silently punishes while they learn
  // — the skill/spell-vs-armor lesson lands once foes actually resist.
  typedDefense: 8,
};

// ── EARLY-GAME SUSTAIN BIAS ───────────────────────────────────────────────────
// A new hero has no life-leech, tiny skills and a shallow mana pool, so raw HP/MP
// regen matters MOST exactly when the affix game hands it out LEAST: low-tier early
// gear carries only a slot or two of affixes drawn from a wide pool, so a specific
// stat like regen rarely lands — which is why regen reads as a "late-game" stat. To
// keep sustain first-class early, a LOW-item-level drop floats ONE in-pool regen stat
// toward the front of its affix pool with a modest chance (present, never guaranteed),
// fading out entirely at EARLY_SUSTAIN_ILVL as tiers deepen and slots open on their
// own. Keyed on the DROP's item level, so only genuinely early gear is nudged — a deep
// hero's high-ilvl drops draw uniformly, exactly as before. Pure data; the draw logic
// lives in addStatAffixes (src/legacy/game.js).
export const EARLY_SUSTAIN_ILVL = 8;        // above this item level: no bias, pool draws uniformly
export const EARLY_SUSTAIN_CHANCE = 0.5;    // chance a qualifying early drop floats a regen stat first
export const EARLY_SUSTAIN_STATS = ['REGEN', 'MPREG'];  // the sustain stats the bias favours early

// ── HOTBAR SLOT RAMP ──────────────────────────────────────────────────────────
// How many of the four hotbar slots are revealed, by deepest floor reached. A new
// hero starts with a single slot (plus the always-present auto-cast slot) and
// earns room on the bar as they descend, so the skill bar never opens as four
// empty boxes. `[floor, slots]`, ascending; the highest floor ≤ maxFloor wins.
export const SKILL_SLOT_RAMP = [
  [1, 1],
  [3, 2],
  [8, 3],
  [13, 4],
];

// ── HAZARD STAGING ────────────────────────────────────────────────────────────
// Placed/active hazards introduce themselves one kind at a time. kind → the floor
// it may first appear on. (Terrain lava/spikes baked by a theme are not gated
// here — only the placed/trap hazards the generator sprinkles in.) The keys match
// the legacy hazard kinds so systems/onboarding.hazardAllowed can gate placement.
export const HAZARD_INTRO_FLOOR = {
  spikes: 3,
  arrowTrap: 6,
  trapChest: 8,
  fireVent: 9,
  hiddenTrap: 11,
  web: 13,
  puddle: 13,
};

// ── EARLY-GAME DIFFICULTY ARC ─────────────────────────────────────────────────
// A new hero's real stats are lopsided: attribute base alone (10 × 2.6 ≈ 26 flat)
// makes even a bare-fisted first hit dwarf a floor-1 foe's ~15-25 HP, so the opening
// used to be pure one-shotting. Rather than clamp per-hit damage to force a hit
// count (the old MIN_EARLY_HITS cap — an artificial rule), we bend the actual
// numbers over the opening floors so kills take a few blows ORGANICALLY: foes carry
// MORE HP and the hero deals LESS, both easing back to full strength by floor 6 as
// levels + gear naturally take over. That is the "weak at the start → earn your
// strength" arc. Guided heroes only (a Veteran opts out of the whole ramp); a
// returning deep hero (high maxFloor) is past it and unaffected.

// Foe max-HP MULTIPLIER over the opening floors (≥1 = tougher). Keyed on deepest
// floor reached, so it only bites a hero genuinely early in its run. Replaces the
// old relief (which REDUCED early HP and, with the damage cap, made trash a
// faceroll). `1` (or absent, floor 6+) = the plain depth-curve HP.
export const EARLY_ENEMY_HP = {
  1: 2.8, 2: 2.4, 3: 2.0, 4: 1.5, 5: 1.18,
};
// Hero-DAMAGE ramp over the opening floors (≤1 = the hero hits softer while weak).
// Keyed on the CURRENT floor. Applied to the hero's rolled hit only — NOT to the
// gear-Power / rating model or the DPS tooltip, which stay depth-independent — so a
// fresh hero organically needs a few swings, then ramps to full by floor 6.
export const PLAYER_EARLY_DMG = {
  1: 0.57, 2: 0.65, 3: 0.76, 4: 0.87, 5: 0.95,
};
// Smaller packs early: a cap on how many foes a normal floor spawns, by floor.
export const EARLY_PACK_CAP = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7 };

// ── BEACH FOE TOUGHNESS ───────────────────────────────────────────────────────
// The shore sizes its foes in BLOWS, not raw HP. A level-1 hero's opening swing
// varies ~2x across the classes (Might feeds auto-attacks through a class-ranked
// lane — a Warrior hits ~19, a Fortune-teller ~8), so the one flat pool the beach
// used to carry meant the same foe fell in 3 swings for one class and 6 for
// another. Each pool is derived from the hero's own weakest opening blow x the
// count below, so every class trades the same number of blows on the sand.
// Unarmed counts: the pack's first kill hands over the starter weapon, so the
// elite goes down in fewer than its 5 once that's worn.
export const BEACH_FOE_HITS = { pack: 3, elite: 5 };
// Floor/ceiling on the derived pool, so an odd build (or a garbage blow estimate)
// can never spawn a 1-HP foe or a wall.
export const BEACH_FOE_HP_CLAMP = { min: 12, max: 140 };

// ── BEACH HEALTH-POTION TEACH ─────────────────────────────────────────────────
// The shore's world-pausing "here's how to heal" gate waits until the hero's
// Health has actually fallen this far (a fraction of max), rather than firing on
// the first scratch — so the lesson lands on a hero who genuinely needs the flask,
// with a wound worth healing, instead of interrupting the opening exchange. Beach
// foes bite for 8 (the elite 16), so a level-1 pool crosses it a blow or two in.
export const BEACH_POTION_HP_FRAC = 0.75;

// ── FIRST-ENCOUNTER HINTS ─────────────────────────────────────────────────────
// One-line teaching chips, each fired at most once per hero and latched by a
// `player.taught[id]` flag. `text` is the chip HTML (may carry <b> and inline
// <span data-spr=…> sprite icons — never a raw emoji as the asset). `wiki`, when
// present, is the wiki article id the chip's "learn more" deep-links to. Ordered
// roughly by when a hero meets them. Kept terse — a chip is glanced, not read.
// Each is ONE short glanceable sentence — the "Learn more ›" link carries the rest.
export const HINTS = {
  // Floors 1–2: after clearing every foe, point at the way down. (The beach
  // tutorial already teaches move+attack; this carries the lesson into floor 1–2.)
  descend: {
    text: `Floor clear — descend deeper down the dungeon.`,
    wiki: 'core-loop',
  },
  // Floor 6–7: nudge toward auto-loot if it is still fully manual.
  autoloot: {
    text: `Set <b>Auto-Loot</b> rules in Settings to sort your drops.`,
    wiki: 'auto-loot',
  },
  // First time a boss winds up a telegraphed attack.
  bossTelegraph: {
    text: `Step off the marked ground before it strikes.`,
    wiki: 'boss-floors',
  },
  // First item that needs more of an attribute than the hero has (renders red).
  requirement: {
    text: `That gear needs more of an attribute than you have.`,
    wiki: 'bases',
  },
  // First time the Spirit Veil shield breaks.
  veil: {
    text: `Your <b>Spirit Veil</b> broke — it soaks hits before Health.`,
    wiki: 'spirit-veil',
  },
  // First mana-gated skill the hero can't afford. (The proactive first-successful-cast
  // lesson is taught by the world-pausing Mana-Potion spotlight gate instead — see
  // maybeTeachFirstSpell in the legacy shell — so it needs no ramp chip here.)
  mana: {
    text: `Out of Mana — it regenerates over time.`,
    wiki: 'mana',
  },
  // First shrine stepped on (shrines activate on contact; a blood shrine costs Health).
  shrine: {
    text: `A <b>shrine</b>'s boon is yours — see it under Status on the HERO tab.`,
    wiki: 'shrines',
  },
  // First fountain used (heals on contact).
  fountain: {
    text: `A <b>fountain</b> fully healed you — each one works only once.`,
    wiki: 'shrines',
  },
  // First teleporter pad.
  teleporter: {
    text: `A <b>teleporter</b> pad warps you to its partner across the floor.`,
    wiki: 'teleporters',
  },
  // First locked vault door.
  vaultDoor: {
    text: `A <b>locked vault</b> — bring the vault key to open its richer haul.`,
    wiki: 'vaults',
  },
  // First cracked wall.
  crackedWall: {
    text: `A <b>cracked wall</b> — strike it a few times to break through.`,
    wiki: 'vaults',
  },
  // (The greed / cursed-floor prompt and the boss-gate confirm are world-pausing
  // overlays that already explain themselves, so they need no separate chip.)
  // First treasure goblin.
  goblin: {
    text: `A <b>treasure goblin</b> — chase it down before it flees with the loot.`,
    wiki: 'goblins',
  },
};

// ── ENDGAME KEEPER INTROS (Hardened 26–50) ───────────────────────────────────
// The late systems a new player has no use for until deep in the run introduce
// themselves as their keeper arrives (waves 5–8, floors 25+). One-time teach
// popups, latched by `player.taught['intro_'+kind]`. kind → { title, text, wiki }.
export const KEEPER_INTRO = {
  weave: { title: 'The Ascendant Weave', text: `Spend Boss Points on a constellation of permanent bonuses. Respec is always free.`, wiki: 'weave' },
  cycles: { title: 'Cycles', text: `Opt into a seasonal ladder with its own rules and a fresh leaderboard.`, wiki: 'cycles' },
  deeds: { title: 'The Hall of Deeds', text: `An account-wide honour roll — cosmetic rewards for milestones across every hero.`, wiki: 'deeds' },
  covenants: { title: 'Dread Covenants', text: `Swear optional curses for far richer loot and rarity. Stack only what you can survive.`, wiki: 'covenants' },
  mirrorforge: { title: 'The Mirrorforge', text: `A deep crafting bench — reforge, exalt and perfect gear with finite Forging Potential.`, wiki: 'mirrorforge' },
  pantheon: { title: 'Pantheon of the Deep', text: `Summon apex bosses on demand for Mythic-only rewards. Bring your best build.`, wiki: 'pantheon' },
};

// The floor each endgame keeper's intro is EXPECTED around (its arrival wave),
// used only to order/space the introductions across Hardened. Purely descriptive.
export const KEEPER_INTRO_FLOOR = { weave: 25, cycles: 25, deeds: 25, covenants: 30, mirrorforge: 40, pantheon: 50 };

// ── STARTER CHECKLIST ────────────────────────────────────────────────────────
// A short first-run chain shown in the objective chip, generalising the old
// "spend your points" nudge into a guided spine. Each step self-completes; the
// chain retires the moment the hero equips their first piece of gear — its final
// step — so the cue never lingers once a new hero is geared up (legacy also
// force-retires on the equip step; see updateObjectiveChip). `done(ctx)` is
// evaluated in legacy against a small context object (systems/onboarding).
export const STARTER_STEPS = [
  { id: 'kill', label: 'Defeat 3 foes' },
  { id: 'equip', label: 'Equip a piece of gear' },
];

// ── ROTATING TIPS ─────────────────────────────────────────────────────────────
// Shown on the death screen (paired with a cause-specific tip) and on load. Plain
// player-facing copy that stands on its own — never references another game.
export const TIPS = [
  `Healing is over time — sip a potion early, not at zero.`,
  `Higher rarity isn't always an upgrade — trust the ▲ arrow, which weighs a stat against YOUR build.`,
  `Skills scale with your weapon; spells scale with Spirit. Gear each on the right pieces.`,
  `Rest at the Healer before a hard push — it leaves you Rested for +25% XP over the next few floors.`,
  `Bank prized gear in the Vault before a risky descent, so a death can't take it.`,
  `Physical armor blunts strikes; magic resist blunts spells. Match your damage to the foe.`,
  `A dash costs Stamina and has no invulnerability — use it to reposition, not to phase through foes.`,
  `Max one skill before spreading points — ranks 3, 7 and 10 each spike its power.`,
  `Lava and spikes never kill outright — but they clamp you to 1 Health. Mind your footing.`,
  `The down-stairs unseal only once every hostile on the floor is dead.`,
];

// ── DEATH-CAUSE TIPS ──────────────────────────────────────────────────────────
// cause tag → the one lesson most worth teaching for that death. Legacy tags the
// killing blow; systems/onboarding.deathTip maps it here (falling back to a
// rotating TIP when the cause is unknown).
export const DEATH_TIPS = {
  lava: `Lava burns while you stand in it — route around it, don't cut across.`,
  spikes: `Spikes stab when you step on them — walk around the barbed tiles.`,
  trap: `Traps fire on a cadence — watch the ground for the tell before you cross.`,
  boss: `Bosses telegraph their big hits — step off the marked ground the instant it lights up.`,
  poison: `Poison keeps ticking after the hit — open distance and let it fade, or rest it off.`,
  ranged: `Ranged foes need line of sight — break it behind a wall, then close in.`,
  swarm: `Swarmed? Back into a corridor so they can't surround you, and thin them one at a time.`,
};
