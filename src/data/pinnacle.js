// ── THE PANTHEON OF THE DEEP · BOSS DEFINITIONS ──────────────────────────────
// The authored capstone encounters. Unlike the fifteen procedural floor guardians
// (BOSSES in src/legacy/game.js), a Pantheon god is SUMMONED on demand: you
// assemble a single-use Effigy from shards + gold (+ chaos for the Uber tier),
// step into a bespoke arena, and fight a fixed, hand-tuned, multi-phase skill check
// that drops EXCLUSIVE Mythic uniques (src/data/pinnacleUniques.js) and pays out
// boss points.
//
// The roster is a Base → Uber staircase: six Base gods any hero can eventually
// summon, each with a harder UBER variant that gates on a minimum Endless depth
// (`uberMinEndlessDepth`) AND on having cleared its Base form first (see
// pinnacle.uberUnlocked). Ubers cost more shards + chaos, have far deeper HP, a
// larger arena, an extra phase or a nastier cadence, and a strictly better loot
// pool + boss-point payout.
//
// This is PURE DATA — arrays, objects and tuned numbers only, no logic and no
// imports from systems/render/legacy. The fight itself is driven by the pure state
// machine in src/systems/pinnacleFight.js, which reads the `phases` authored here;
// the summon/loot/gating math lives in src/systems/pinnacle.js. Field guide:
//
//   id                  stable key, saved on the hero's clear ledger — never reused
//   name                the god's proper name (player-facing)
//   atlasKey            placeholder sprite-sheet key (real pixel art wired later)
//   tier                'base' | 'uber'
//   uberOf              for an Uber: the id of the Base it ascends from (else null)
//   uberMinEndlessDepth for an Uber: min Endless floor reached before it can summon
//   summon              the Effigy recipe: { shards:{type,count}, gold, chaos? }
//   arena               { w, h } bespoke room size in tiles (bigger for Ubers)
//   hp                  { mult } — HP as a multiple of a same-depth ordinary boss
//   phases[]            the authored fight, HIGH → LOW hp fraction (see below)
//   loot                { pool:[mythicUniqueId], pityThreshold, dropChance }
//   bossPointPayout     boss points granted per clear (first clear pays the bonus too)
//   firstClearBonus     one-time reward the first time this god is felled
//
// A PHASE (each element of `phases`, authored in descending atHpFrac order):
//   id            phase label
//   atHpFrac      the boss enters this phase when its hp fraction ≤ this value.
//                 Phase 0 is 1.0 (active from full HP). Draining the boss past each
//                 lower threshold advances the phase (see pinnacleFight.stepFight).
//   telegraphs[]  the phase's attacks. Each: { id, kind, windupSec, damageMult }.
//                 `kind` maps to a telegraph shape at the edge (disc/ring/lane/cone/
//                 …); `windupSec` is the dodge window; `damageMult` scales the hit
//                 off the boss's base swing. The state machine arms these on a
//                 windup cadence, so each re-fires every windupSec it is on-screen.
//   addWave       optional { count, everySec } — spawns `count` adds every `everySec`
//                 while this phase is active (the swarm/summoner mechanic).
//   enrageAtSec   optional soft-enrage: this many seconds INTO the phase, the boss
//                 enrages (permanent +damage) — a per-phase DPS check.

// ── Shared shard economy ──────────────────────────────────────────────────────
// Six thematic shard currencies, one family per god-lineage. A hero farms a
// lineage's shards from the world/Endless, banks them, and spends a fixed count to
// forge that god's Effigy. Ubers demand a stiffer count of the SAME shard plus
// chaos (the deep-Endless currency), so an Uber is a real savings goal.
export const PANTHEON_SHARDS = {
  tide: 'tideheartShard',   // Thallor lineage — drowned/tidal
  void: 'voidcinderShard',  // Nyxara lineage — starved void
  ember: 'emberscaleShard', // Vorgrim lineage — ashen fire
  thorn: 'thornseedShard',  // Sylvaine lineage — bramble/swarm
  storm: 'stormglassShard', // Kaethon lineage — stormcrowned
  hollow: 'hollowechoShard', // Umbriel lineage — the hollow choir
};

// A tiny helper so telegraph authoring stays terse and readable below.
const tel = (id, kind, windupSec, damageMult) => ({ id, kind, windupSec, damageMult });

export const PANTHEON = [
  // ══════════════════════════════════════════════════════════════════════════
  // 1 · THALLOR, THE DROWNED COLOSSUS — a slow, telegraph-heavy brute. Three
  // phases: wide slams → a tightening tide-ring → a desperate flurry. The classic
  // "learn the tells, punish the recovery" fight. Base of the tide lineage.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'thallor', name: 'Thallor, the Drowned Colossus', atlasKey: 'pin_thallor',
    tier: 'base', uberOf: null, uberMinEndlessDepth: 0,
    summon: { shards: { type: PANTHEON_SHARDS.tide, count: 12 }, gold: 40000 },
    arena: { w: 27, h: 27 }, hp: { mult: 9 },
    phases: [
      { id: 'crush', atHpFrac: 1.0, telegraphs: [
        tel('tidalSlam', 'disc', 1.6, 2.4),
        tel('undertowLane', 'lane', 1.2, 1.6),
      ] },
      { id: 'floodring', atHpFrac: 0.6, telegraphs: [
        tel('risingRing', 'ring', 1.8, 2.8),
        tel('tidalSlam', 'disc', 1.4, 2.4),
      ], enrageAtSec: 45 },
      { id: 'drowning', atHpFrac: 0.25, telegraphs: [
        tel('undertowLane', 'lane', 0.9, 2.0),
        tel('crashDisc', 'disc', 1.0, 3.0),
      ], enrageAtSec: 30 },
    ],
    loot: { pool: ['pin_drownedVerdict', 'pin_deepwaterHeart'], pityThreshold: 6, dropChance: 0.45 },
    bossPointPayout: 3,
    firstClearBonus: { gold: 25000, shards: { type: PANTHEON_SHARDS.tide, count: 6 }, chaos: 1 },
  },
  {
    id: 'thallorUber', name: 'Thallor Unbound, the Abyssal Tide', atlasKey: 'pin_thallor_uber',
    tier: 'uber', uberOf: 'thallor', uberMinEndlessDepth: 90,
    summon: { shards: { type: PANTHEON_SHARDS.tide, count: 40 }, gold: 150000, chaos: 8 },
    arena: { w: 33, h: 33 }, hp: { mult: 22 },
    phases: [
      { id: 'crush', atHpFrac: 1.0, telegraphs: [
        tel('tidalSlam', 'disc', 1.3, 3.2),
        tel('undertowLane', 'lane', 1.0, 2.2),
      ] },
      { id: 'floodring', atHpFrac: 0.7, telegraphs: [
        tel('risingRing', 'ring', 1.4, 3.6),
        tel('tidalSlam', 'disc', 1.1, 3.2),
      ], enrageAtSec: 40 },
      { id: 'maelstrom', atHpFrac: 0.4, telegraphs: [
        tel('spiralRing', 'ring', 1.2, 3.4),
        tel('crashDisc', 'disc', 0.9, 3.8),
      ], addWave: { count: 2, everySec: 12 }, enrageAtSec: 35 },
      { id: 'drowning', atHpFrac: 0.15, telegraphs: [
        tel('undertowLane', 'lane', 0.7, 2.8),
        tel('crashDisc', 'disc', 0.8, 4.4),
      ], enrageAtSec: 22 },
    ],
    loot: { pool: ['pin_drownedVerdict', 'pin_deepwaterHeart', 'pin_apexSignet'], pityThreshold: 5, dropChance: 0.6 },
    bossPointPayout: 8,
    firstClearBonus: { gold: 90000, shards: { type: PANTHEON_SHARDS.tide, count: 20 }, chaos: 5 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2 · NYXARA, THE STARVED VOID — a four-phase caster. Long-range cones and rings
  // with narrow safe gaps; the fourth phase is a frantic short-windup burst. No
  // adds — pure positional reading. Base of the void lineage.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'nyxara', name: 'Nyxara, the Starved Void', atlasKey: 'pin_nyxara',
    tier: 'base', uberOf: null, uberMinEndlessDepth: 0,
    summon: { shards: { type: PANTHEON_SHARDS.void, count: 12 }, gold: 45000 },
    arena: { w: 29, h: 29 }, hp: { mult: 8 },
    phases: [
      { id: 'gaze', atHpFrac: 1.0, telegraphs: [
        tel('voidCone', 'cone', 1.5, 2.0),
      ] },
      { id: 'hunger', atHpFrac: 0.7, telegraphs: [
        tel('voidCone', 'cone', 1.3, 2.2),
        tel('collapseRing', 'ring', 1.6, 2.6),
      ] },
      { id: 'famine', atHpFrac: 0.45, telegraphs: [
        tel('starvedLane', 'lane', 1.1, 2.4),
        tel('collapseRing', 'ring', 1.3, 2.8),
      ], enrageAtSec: 40 },
      { id: 'devour', atHpFrac: 0.2, telegraphs: [
        tel('voidCone', 'cone', 0.8, 2.6),
        tel('singularity', 'disc', 0.9, 3.4),
      ], enrageAtSec: 25 },
    ],
    loot: { pool: ['pin_voidsongScepter', 'pin_hollowCrown'], pityThreshold: 6, dropChance: 0.45 },
    bossPointPayout: 3,
    firstClearBonus: { gold: 28000, shards: { type: PANTHEON_SHARDS.void, count: 6 }, chaos: 1 },
  },
  {
    id: 'nyxaraUber', name: 'Nyxara Ascendant, the All-Devouring', atlasKey: 'pin_nyxara_uber',
    tier: 'uber', uberOf: 'nyxara', uberMinEndlessDepth: 110,
    summon: { shards: { type: PANTHEON_SHARDS.void, count: 44 }, gold: 165000, chaos: 10 },
    arena: { w: 35, h: 35 }, hp: { mult: 24 },
    phases: [
      { id: 'gaze', atHpFrac: 1.0, telegraphs: [
        tel('voidCone', 'cone', 1.1, 2.8),
        tel('collapseRing', 'ring', 1.4, 3.2),
      ] },
      { id: 'hunger', atHpFrac: 0.75, telegraphs: [
        tel('twinCone', 'cone', 1.0, 3.0),
        tel('collapseRing', 'ring', 1.2, 3.4),
      ], enrageAtSec: 38 },
      { id: 'famine', atHpFrac: 0.5, telegraphs: [
        tel('starvedLane', 'lane', 0.9, 3.2),
        tel('singularity', 'disc', 1.0, 3.8),
      ], enrageAtSec: 32 },
      { id: 'devour', atHpFrac: 0.25, telegraphs: [
        tel('twinCone', 'cone', 0.7, 3.4),
        tel('collapseRing', 'ring', 0.9, 3.8),
      ], enrageAtSec: 26 },
      { id: 'eventHorizon', atHpFrac: 0.1, telegraphs: [
        tel('singularity', 'disc', 0.6, 5.0),
        tel('starvedLane', 'lane', 0.6, 3.6),
      ], enrageAtSec: 18 },
    ],
    loot: { pool: ['pin_voidsongScepter', 'pin_hollowCrown', 'pin_apexSignet'], pityThreshold: 5, dropChance: 0.6 },
    bossPointPayout: 9,
    firstClearBonus: { gold: 100000, shards: { type: PANTHEON_SHARDS.void, count: 22 }, chaos: 6 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 3 · VORGRIM, THE ASHEN TYRANT — an aggressive two-into-three phase brute with
  // an early soft-enrage. Rewards ending the fight fast; punishes a slow kill with
  // a scorching flurry. Base of the ember lineage.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'vorgrim', name: 'Vorgrim, the Ashen Tyrant', atlasKey: 'pin_vorgrim',
    tier: 'base', uberOf: null, uberMinEndlessDepth: 0,
    summon: { shards: { type: PANTHEON_SHARDS.ember, count: 10 }, gold: 42000 },
    arena: { w: 25, h: 25 }, hp: { mult: 7 },
    phases: [
      { id: 'kindle', atHpFrac: 1.0, telegraphs: [
        tel('emberLane', 'lane', 1.3, 2.0),
        tel('cinderDisc', 'disc', 1.5, 2.4),
      ], enrageAtSec: 50 },
      { id: 'blaze', atHpFrac: 0.5, telegraphs: [
        tel('firestormRing', 'ring', 1.4, 2.8),
        tel('emberLane', 'lane', 1.0, 2.2),
      ], enrageAtSec: 35 },
      { id: 'immolate', atHpFrac: 0.2, telegraphs: [
        tel('cinderDisc', 'disc', 0.8, 3.2),
        tel('emberLane', 'lane', 0.7, 2.6),
      ], enrageAtSec: 20 },
    ],
    loot: { pool: ['pin_stormfeather', 'pin_ashenAegis'], pityThreshold: 6, dropChance: 0.45 },
    bossPointPayout: 3,
    firstClearBonus: { gold: 24000, shards: { type: PANTHEON_SHARDS.ember, count: 6 }, chaos: 1 },
  },
  {
    id: 'vorgrimUber', name: 'Vorgrim Rekindled, the Suneater', atlasKey: 'pin_vorgrim_uber',
    tier: 'uber', uberOf: 'vorgrim', uberMinEndlessDepth: 95,
    summon: { shards: { type: PANTHEON_SHARDS.ember, count: 38 }, gold: 155000, chaos: 8 },
    arena: { w: 31, h: 31 }, hp: { mult: 20 },
    phases: [
      { id: 'kindle', atHpFrac: 1.0, telegraphs: [
        tel('emberLane', 'lane', 1.0, 2.8),
        tel('cinderDisc', 'disc', 1.2, 3.2),
      ], enrageAtSec: 42 },
      { id: 'blaze', atHpFrac: 0.6, telegraphs: [
        tel('firestormRing', 'ring', 1.1, 3.6),
        tel('emberLane', 'lane', 0.8, 3.0),
      ], addWave: { count: 3, everySec: 10 }, enrageAtSec: 32 },
      { id: 'immolate', atHpFrac: 0.3, telegraphs: [
        tel('cinderDisc', 'disc', 0.7, 4.0),
        tel('firestormRing', 'ring', 0.9, 3.8),
      ], enrageAtSec: 22 },
      { id: 'supernova', atHpFrac: 0.1, telegraphs: [
        tel('cinderDisc', 'disc', 0.6, 5.2),
        tel('emberLane', 'lane', 0.5, 3.4),
      ], enrageAtSec: 15 },
    ],
    loot: { pool: ['pin_stormfeather', 'pin_ashenAegis', 'pin_apexSignet'], pityThreshold: 5, dropChance: 0.6 },
    bossPointPayout: 8,
    firstClearBonus: { gold: 92000, shards: { type: PANTHEON_SHARDS.ember, count: 20 }, chaos: 5 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 4 · SYLVAINE, THE THORNQUEEN — the SWARM fight. Modest direct telegraphs but a
  // relentless add cadence in every phase; you win by clearing waves without losing
  // the boss. Four phases, escalating spawn rate. Base of the thorn lineage.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'sylvaine', name: 'Sylvaine, the Thornqueen', atlasKey: 'pin_sylvaine',
    tier: 'base', uberOf: null, uberMinEndlessDepth: 0,
    summon: { shards: { type: PANTHEON_SHARDS.thorn, count: 11 }, gold: 43000 },
    arena: { w: 28, h: 28 }, hp: { mult: 8 },
    phases: [
      { id: 'seed', atHpFrac: 1.0, telegraphs: [
        tel('brambleCone', 'cone', 1.6, 1.8),
      ], addWave: { count: 2, everySec: 14 } },
      { id: 'bloom', atHpFrac: 0.65, telegraphs: [
        tel('thornRing', 'ring', 1.5, 2.2),
        tel('brambleCone', 'cone', 1.3, 2.0),
      ], addWave: { count: 3, everySec: 12 }, enrageAtSec: 45 },
      { id: 'overgrow', atHpFrac: 0.35, telegraphs: [
        tel('lashLane', 'lane', 1.0, 2.4),
        tel('thornRing', 'ring', 1.2, 2.6),
      ], addWave: { count: 3, everySec: 9 }, enrageAtSec: 35 },
      { id: 'wither', atHpFrac: 0.12, telegraphs: [
        tel('lashLane', 'lane', 0.8, 2.8),
        tel('brambleCone', 'cone', 0.9, 2.6),
      ], addWave: { count: 4, everySec: 8 }, enrageAtSec: 25 },
    ],
    loot: { pool: ['pin_tidewall', 'pin_deepwaterHeart'], pityThreshold: 6, dropChance: 0.45 },
    bossPointPayout: 3,
    firstClearBonus: { gold: 26000, shards: { type: PANTHEON_SHARDS.thorn, count: 6 }, chaos: 1 },
  },
  {
    id: 'sylvaineUber', name: 'Sylvaine Everblooming, the World-Root', atlasKey: 'pin_sylvaine_uber',
    tier: 'uber', uberOf: 'sylvaine', uberMinEndlessDepth: 100,
    summon: { shards: { type: PANTHEON_SHARDS.thorn, count: 42 }, gold: 160000, chaos: 9 },
    arena: { w: 34, h: 34 }, hp: { mult: 23 },
    phases: [
      { id: 'seed', atHpFrac: 1.0, telegraphs: [
        tel('brambleCone', 'cone', 1.2, 2.6),
        tel('thornRing', 'ring', 1.4, 2.8),
      ], addWave: { count: 3, everySec: 10 } },
      { id: 'bloom', atHpFrac: 0.7, telegraphs: [
        tel('thornRing', 'ring', 1.1, 3.2),
        tel('lashLane', 'lane', 0.9, 2.8),
      ], addWave: { count: 4, everySec: 9 }, enrageAtSec: 40 },
      { id: 'overgrow', atHpFrac: 0.4, telegraphs: [
        tel('lashLane', 'lane', 0.8, 3.0),
        tel('brambleCone', 'cone', 1.0, 3.0),
      ], addWave: { count: 5, everySec: 7 }, enrageAtSec: 32 },
      { id: 'wither', atHpFrac: 0.15, telegraphs: [
        tel('thornRing', 'ring', 0.8, 3.4),
        tel('lashLane', 'lane', 0.6, 3.2),
      ], addWave: { count: 6, everySec: 6 }, enrageAtSec: 24 },
    ],
    loot: { pool: ['pin_tidewall', 'pin_deepwaterHeart', 'pin_apexSignet'], pityThreshold: 5, dropChance: 0.6 },
    bossPointPayout: 8,
    firstClearBonus: { gold: 94000, shards: { type: PANTHEON_SHARDS.thorn, count: 21 }, chaos: 5 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 5 · KAETHON, THE STORMCROWNED — a fast, low-windup lane/ring caster. Short tells
  // demand tight movement; every phase soft-enrages quickly. Three phases. Base of
  // the storm lineage.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'kaethon', name: 'Kaethon, the Stormcrowned', atlasKey: 'pin_kaethon',
    tier: 'base', uberOf: null, uberMinEndlessDepth: 0,
    summon: { shards: { type: PANTHEON_SHARDS.storm, count: 11 }, gold: 46000 },
    arena: { w: 27, h: 27 }, hp: { mult: 8 },
    phases: [
      { id: 'gather', atHpFrac: 1.0, telegraphs: [
        tel('boltLane', 'lane', 1.1, 2.0),
        tel('staticRing', 'ring', 1.4, 2.4),
      ], enrageAtSec: 45 },
      { id: 'tempest', atHpFrac: 0.55, telegraphs: [
        tel('forkLane', 'lane', 0.9, 2.4),
        tel('staticRing', 'ring', 1.1, 2.8),
      ], enrageAtSec: 32 },
      { id: 'thunderhead', atHpFrac: 0.22, telegraphs: [
        tel('boltLane', 'lane', 0.6, 2.8),
        tel('strikeDisc', 'disc', 0.7, 3.2),
      ], enrageAtSec: 20 },
    ],
    loot: { pool: ['pin_stormfeather', 'pin_hollowCrown'], pityThreshold: 6, dropChance: 0.45 },
    bossPointPayout: 3,
    firstClearBonus: { gold: 27000, shards: { type: PANTHEON_SHARDS.storm, count: 6 }, chaos: 1 },
  },
  {
    id: 'kaethonUber', name: 'Kaethon Skyshatter, the Ten-Storm', atlasKey: 'pin_kaethon_uber',
    tier: 'uber', uberOf: 'kaethon', uberMinEndlessDepth: 105,
    summon: { shards: { type: PANTHEON_SHARDS.storm, count: 43 }, gold: 162000, chaos: 9 },
    arena: { w: 32, h: 32 }, hp: { mult: 21 },
    phases: [
      { id: 'gather', atHpFrac: 1.0, telegraphs: [
        tel('boltLane', 'lane', 0.9, 2.8),
        tel('staticRing', 'ring', 1.1, 3.2),
      ], enrageAtSec: 40 },
      { id: 'tempest', atHpFrac: 0.6, telegraphs: [
        tel('forkLane', 'lane', 0.7, 3.2),
        tel('staticRing', 'ring', 0.9, 3.6),
      ], enrageAtSec: 30 },
      { id: 'thunderhead', atHpFrac: 0.3, telegraphs: [
        tel('forkLane', 'lane', 0.6, 3.4),
        tel('strikeDisc', 'disc', 0.6, 4.0),
      ], enrageAtSec: 22 },
      { id: 'cataclysm', atHpFrac: 0.1, telegraphs: [
        tel('strikeDisc', 'disc', 0.5, 4.8),
        tel('boltLane', 'lane', 0.4, 3.6),
      ], enrageAtSec: 14 },
    ],
    loot: { pool: ['pin_stormfeather', 'pin_hollowCrown', 'pin_apexSignet'], pityThreshold: 5, dropChance: 0.6 },
    bossPointPayout: 8,
    firstClearBonus: { gold: 96000, shards: { type: PANTHEON_SHARDS.storm, count: 21 }, chaos: 5 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 6 · UMBRIEL, THE HOLLOW CHOIR — the hardest BASE fight: FIVE phases, mixing
  // every shape, with adds in the mid phases and a lethal final flurry. The
  // graduation exam before the Ubers. Base of the hollow lineage.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'umbriel', name: 'Umbriel, the Hollow Choir', atlasKey: 'pin_umbriel',
    tier: 'base', uberOf: null, uberMinEndlessDepth: 0,
    summon: { shards: { type: PANTHEON_SHARDS.hollow, count: 14 }, gold: 55000, chaos: 2 },
    arena: { w: 30, h: 30 }, hp: { mult: 11 },
    phases: [
      { id: 'prelude', atHpFrac: 1.0, telegraphs: [
        tel('echoCone', 'cone', 1.5, 2.0),
        tel('hollowRing', 'ring', 1.6, 2.4),
      ] },
      { id: 'verse', atHpFrac: 0.75, telegraphs: [
        tel('choirLane', 'lane', 1.2, 2.2),
        tel('echoCone', 'cone', 1.2, 2.4),
      ], enrageAtSec: 45 },
      { id: 'chorus', atHpFrac: 0.5, telegraphs: [
        tel('hollowRing', 'ring', 1.1, 2.8),
        tel('choirLane', 'lane', 1.0, 2.6),
      ], addWave: { count: 3, everySec: 11 }, enrageAtSec: 38 },
      { id: 'crescendo', atHpFrac: 0.28, telegraphs: [
        tel('echoCone', 'cone', 0.9, 3.0),
        tel('nullDisc', 'disc', 1.0, 3.4),
      ], addWave: { count: 2, everySec: 10 }, enrageAtSec: 30 },
      { id: 'silence', atHpFrac: 0.1, telegraphs: [
        tel('nullDisc', 'disc', 0.7, 4.2),
        tel('choirLane', 'lane', 0.6, 3.0),
      ], enrageAtSec: 18 },
    ],
    loot: { pool: ['pin_hollowCrown', 'pin_voidsongScepter', 'pin_apexSignet'], pityThreshold: 5, dropChance: 0.5 },
    bossPointPayout: 4,
    firstClearBonus: { gold: 40000, shards: { type: PANTHEON_SHARDS.hollow, count: 8 }, chaos: 3 },
  },
  {
    id: 'umbrielUber', name: 'Umbriel, the Unsung Silence', atlasKey: 'pin_umbriel_uber',
    tier: 'uber', uberOf: 'umbriel', uberMinEndlessDepth: 130,
    summon: { shards: { type: PANTHEON_SHARDS.hollow, count: 50 }, gold: 200000, chaos: 14 },
    arena: { w: 37, h: 37 }, hp: { mult: 28 },
    phases: [
      { id: 'prelude', atHpFrac: 1.0, telegraphs: [
        tel('echoCone', 'cone', 1.1, 2.8),
        tel('hollowRing', 'ring', 1.2, 3.2),
      ] },
      { id: 'verse', atHpFrac: 0.78, telegraphs: [
        tel('choirLane', 'lane', 0.9, 3.0),
        tel('twinEcho', 'cone', 1.0, 3.2),
      ], enrageAtSec: 40 },
      { id: 'chorus', atHpFrac: 0.56, telegraphs: [
        tel('hollowRing', 'ring', 0.9, 3.6),
        tel('choirLane', 'lane', 0.8, 3.2),
      ], addWave: { count: 4, everySec: 9 }, enrageAtSec: 34 },
      { id: 'crescendo', atHpFrac: 0.36, telegraphs: [
        tel('twinEcho', 'cone', 0.7, 3.6),
        tel('nullDisc', 'disc', 0.8, 4.2),
      ], addWave: { count: 3, everySec: 8 }, enrageAtSec: 28 },
      { id: 'requiem', atHpFrac: 0.2, telegraphs: [
        tel('nullDisc', 'disc', 0.6, 4.8),
        tel('hollowRing', 'ring', 0.7, 4.0),
      ], enrageAtSec: 22 },
      { id: 'silence', atHpFrac: 0.08, telegraphs: [
        tel('nullDisc', 'disc', 0.5, 6.0),
        tel('choirLane', 'lane', 0.4, 3.8),
      ], enrageAtSec: 14 },
    ],
    loot: { pool: ['pin_hollowCrown', 'pin_voidsongScepter', 'pin_apexSignet', 'pin_drownedVerdict'], pityThreshold: 4, dropChance: 0.7 },
    bossPointPayout: 12,
    firstClearBonus: { gold: 130000, shards: { type: PANTHEON_SHARDS.hollow, count: 26 }, chaos: 8 },
  },
];
