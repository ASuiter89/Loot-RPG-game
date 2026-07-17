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

// ── GENTLER OPENING DIFFICULTY ────────────────────────────────────────────────
// A soft relief multiplier applied to foe HP/damage on the very first floors, on
// top of the normal depth curve, so floors 1–5 breathe before the game ramps. `1`
// (or absent) = no relief. Legacy multiplies enemy HP/damage by this.
export const EARLY_RELIEF = {
  1: 0.6, 2: 0.68, 3: 0.78, 4: 0.88, 5: 0.95,
};
// Smaller packs early: a cap on how many foes a normal floor spawns, by floor.
export const EARLY_PACK_CAP = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7 };

// ── FIRST-ENCOUNTER HINTS ─────────────────────────────────────────────────────
// One-line teaching chips, each fired at most once per hero and latched by a
// `player.taught[id]` flag. `text` is the chip HTML (may carry <b> and inline
// <span data-spr=…> sprite icons — never a raw emoji as the asset). `wiki`, when
// present, is the wiki article id the chip's "learn more" deep-links to. Ordered
// roughly by when a hero meets them. Kept terse — a chip is glanced, not read.
export const HINTS = {
  // Floors 1–2: after clearing every foe, point at the way down. (The beach
  // tutorial already teaches move+attack; this carries the lesson into floor 1–2.)
  descend: {
    text: `Floor clear! Step onto the <span data-spr=ic_down></span> down-stairs to descend.`,
    wiki: 'core-loop',
  },
  // Floor 6–7: nudge toward auto-loot if it is still fully manual.
  autoloot: {
    text: `Bag filling up? Set <b>Auto-Loot</b> rules in Settings to sort drops for you.`,
    wiki: 'auto-loot',
  },
  // First time a boss winds up a telegraphed attack.
  bossTelegraph: {
    text: `<b>Watch out!</b> Step off the marked ground before it strikes.`,
    wiki: 'boss-floors',
  },
  // First item that needs more of an attribute than the hero has (renders red).
  requirement: {
    text: `That gear needs more of an attribute to wear — raise it, or find a lighter base.`,
    wiki: 'bases',
  },
  // First time the Spirit Veil shield breaks.
  veil: {
    text: `Your <b>Spirit Veil</b> broke — it soaks hits before Health and refills once you stop taking damage.`,
    wiki: 'spirit-veil',
  },
  // First mana-gated skill the hero can't afford.
  mana: {
    text: `Out of Mana for that skill — it regenerates over time (slower in a fight).`,
    wiki: 'mana',
  },
  // First shrine stepped on (shrines activate on contact; a blood shrine costs Health).
  shrine: {
    text: `A <b>shrine</b>'s boon is now yours — watch the log for its effect. Some shrines cost Health.`,
    wiki: 'shrines',
  },
  // First fountain used (heals on contact).
  fountain: {
    text: `A <b>fountain</b> fully restored you — each works once, so save the next for when you're hurt.`,
    wiki: 'shrines',
  },
  // First teleporter pad.
  teleporter: {
    text: `A <b>teleporter</b> pad warps you to its partner elsewhere on the floor.`,
    wiki: 'teleporters',
  },
  // First locked vault door.
  vaultDoor: {
    text: `A <b>locked vault</b> — carry the vault key to open it for a richer haul.`,
    wiki: 'vaults',
  },
  // First cracked wall.
  crackedWall: {
    text: `A <b>cracked wall</b> — strike it a few times to break through to what's sealed behind.`,
    wiki: 'vaults',
  },
  // (The greed / cursed-floor prompt and the boss-gate confirm are world-pausing
  // overlays that already explain themselves, so they need no separate chip.)
  // First treasure goblin.
  goblin: {
    text: `A <b>treasure goblin</b> — it flees, then drops a jackpot. Chase it down before it escapes.`,
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
// chain retires once every step is done. `done(ctx)` is evaluated in legacy
// against a small context object (see systems/onboarding.starterStep).
export const STARTER_STEPS = [
  { id: 'kill', label: 'Defeat 3 foes' },
  { id: 'equip', label: 'Equip a piece of gear' },
  { id: 'skill', label: 'Spend a skill point' },
  { id: 'descend', label: 'Take the stairs down' },
  { id: 'boss', label: 'Beat the floor 5 boss' },
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
