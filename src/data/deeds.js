// THE HALL OF DEEDS — the master deed catalog. PURE VALUES only (no imports from
// systems/render/legacy). Each deed is one account-wide milestone that fuses a slice
// of every long-horizon system into a single RENOWN economy.
//
// ── The account SNAPSHOT contract (what systems/deeds.js reads) ────────────────
// A deed is satisfied by comparing its `requirement.threshold` against one number
// pulled from a plain, read-only account snapshot the shell assembles once per open:
//
//   {
//     collection: { have, total },        // uniqueCollection.collectionProgress()
//     bestiary:   { discovered, total },  // bestiary discovered / total species
//     diffCleared: 0..3,                  // difficulties conquered (Normal→Brutal)
//     maxFloor:    int,                   // deepest floor ever reached (depth.js)
//     endlessFloor:int,                   // deepest ENDLESS floor reached
//     bounties:  { total, perClass:{[cls]:count} }, // lifetime bounties completed
//     classesPlayed: [ids],               // distinct classes ever levelled
//     setsCompleted: int,                 // full item-sets ever assembled
//     mirrored:      int,                 // (optional) items forged in the Mirrorforge
//   }
//
// `requirement.kind` names WHICH number: it maps to a snapshot path in
// systems/deeds.js (collectionHave→collection.have, classesPlayed→classesPlayed
// .length, etc.), so a deed is a generic {kind, threshold} — no per-deed predicate
// code. Adding a deed is a data edit; adding a new AXIS is one line in the reader map.
//
// Renown is POWER-FREE: it only buys stash tabs, frames, badges, titles and QoL —
// never a stat — so chasing deeds never gates power behind grind.
//
// TUNING NOTES on the ladder:
//   • Front-loaded: the first deed in most categories has a tiny threshold (reach
//     floor 2, complete 1 bounty, discover 5 species) so ordinary early play
//     auto-completes a handful and the Hall lights up immediately.
//   • Long tail: the capstones (endless 100, all difficulties, 150 collected) are
//     genuine end-of-account goals, worth the largest renown so the top ranks of
//     RENOWN_TRACK demand near-total completion.
//   • `sprite` is a placeholder atlas key (real pixel art authored later); the shell
//     resolves it via drawSpriteC/dlIcon — never an emoji standing in for the icon.
export const DEEDS = [
  // ── COLLECTION — one of every authored artifact (uniqueCollection catalog) ──
  { id: 'col_first',   category: 'collection', name: 'First Find',      desc: 'Store your first unique or set piece in the Vault.', requirement: { kind: 'collectionHave', threshold: 1 },   renown: 40,  sprite: 'deed_col_1' },
  { id: 'col_ten',     category: 'collection', name: 'Curator',         desc: 'Collect 10 distinct artifacts.',                    requirement: { kind: 'collectionHave', threshold: 10 },  renown: 80,  sprite: 'deed_col_10' },
  { id: 'col_25',      category: 'collection', name: 'Antiquarian',     desc: 'Collect 25 distinct artifacts.',                    requirement: { kind: 'collectionHave', threshold: 25 },  renown: 150, sprite: 'deed_col_25' },
  { id: 'col_50',      category: 'collection', name: 'Hoard Keeper',    desc: 'Collect 50 distinct artifacts.',                    requirement: { kind: 'collectionHave', threshold: 50 },  renown: 300, sprite: 'deed_col_50' },
  { id: 'col_100',     category: 'collection', name: 'Grand Collector', desc: 'Collect 100 distinct artifacts.',                   requirement: { kind: 'collectionHave', threshold: 100 }, renown: 600, sprite: 'deed_col_100' },
  { id: 'col_150',     category: 'collection', name: 'Completionist',   desc: 'Collect 150 distinct artifacts.',                   requirement: { kind: 'collectionHave', threshold: 150 }, renown: 900, sprite: 'deed_col_150' },
  // Full item-SETS assembled — a collection sub-goal that rewards finishing a set.
  { id: 'set_one',     category: 'collection', name: 'Matched Set',     desc: 'Complete a full item set.',                         requirement: { kind: 'setsCompleted', threshold: 1 },   renown: 100, sprite: 'deed_set_1' },
  { id: 'set_three',   category: 'collection', name: 'Set Seeker',      desc: 'Complete 3 full item sets.',                        requirement: { kind: 'setsCompleted', threshold: 3 },   renown: 250, sprite: 'deed_set_3' },
  { id: 'set_six',     category: 'collection', name: 'Set Master',      desc: 'Complete 6 full item sets.',                        requirement: { kind: 'setsCompleted', threshold: 6 },   renown: 500, sprite: 'deed_set_6' },

  // ── BESTIARY — species discovered in the codex (account-wide dex) ──
  { id: 'bes_5',   category: 'bestiary', name: 'Field Notes',    desc: 'Discover 5 species.',  requirement: { kind: 'bestiaryDiscovered', threshold: 5 },  renown: 40,  sprite: 'deed_bes_5' },
  { id: 'bes_15',  category: 'bestiary', name: 'Naturalist',     desc: 'Discover 15 species.', requirement: { kind: 'bestiaryDiscovered', threshold: 15 }, renown: 90,  sprite: 'deed_bes_15' },
  { id: 'bes_30',  category: 'bestiary', name: 'Zoologist',      desc: 'Discover 30 species.', requirement: { kind: 'bestiaryDiscovered', threshold: 30 }, renown: 200, sprite: 'deed_bes_30' },
  { id: 'bes_50',  category: 'bestiary', name: 'Lorekeeper',     desc: 'Discover 50 species.', requirement: { kind: 'bestiaryDiscovered', threshold: 50 }, renown: 400, sprite: 'deed_bes_50' },
  { id: 'bes_75',  category: 'bestiary', name: 'Codex Complete', desc: 'Discover 75 species.', requirement: { kind: 'bestiaryDiscovered', threshold: 75 }, renown: 700, sprite: 'deed_bes_75' },

  // ── CONQUEST — difficulties conquered (Normal → Hardened → Brutal) ──
  { id: 'conq_1', category: 'conquest', name: 'Conqueror',     desc: 'Conquer one difficulty.',   requirement: { kind: 'diffCleared', threshold: 1 }, renown: 150, sprite: 'deed_conq_1' },
  { id: 'conq_2', category: 'conquest', name: 'Warbringer',    desc: 'Conquer two difficulties.', requirement: { kind: 'diffCleared', threshold: 2 }, renown: 350, sprite: 'deed_conq_2' },
  { id: 'conq_3', category: 'conquest', name: 'Grand Champion',desc: 'Conquer all difficulties.', requirement: { kind: 'diffCleared', threshold: 3 }, renown: 700, sprite: 'deed_conq_3' },

  // ── DEPTH — deepest floor ever reached, plus a dedicated Endless ladder ──
  { id: 'dep_2',   category: 'depth', name: 'First Steps',   desc: 'Reach floor 2.',       requirement: { kind: 'maxFloor', threshold: 2 },  renown: 30,  sprite: 'deed_dep_2' },
  { id: 'dep_10',  category: 'depth', name: 'Spelunker',     desc: 'Reach floor 10.',      requirement: { kind: 'maxFloor', threshold: 10 }, renown: 80,  sprite: 'deed_dep_10' },
  { id: 'dep_25',  category: 'depth', name: 'Deep Diver',    desc: 'Reach floor 25.',      requirement: { kind: 'maxFloor', threshold: 25 }, renown: 200, sprite: 'deed_dep_25' },
  { id: 'dep_50',  category: 'depth', name: 'Abyss Walker',  desc: 'Reach floor 50.',      requirement: { kind: 'maxFloor', threshold: 50 }, renown: 400, sprite: 'deed_dep_50' },
  { id: 'dep_75',  category: 'depth', name: 'The Brink',     desc: 'Reach floor 75.',      requirement: { kind: 'maxFloor', threshold: 75 }, renown: 600, sprite: 'deed_dep_75' },
  { id: 'end_10',  category: 'depth', name: 'Endless Delver',desc: 'Reach Endless floor 10.',  requirement: { kind: 'endlessFloor', threshold: 10 },  renown: 250,  sprite: 'deed_end_10' },
  { id: 'end_50',  category: 'depth', name: 'Voidbound',     desc: 'Reach Endless floor 50.',  requirement: { kind: 'endlessFloor', threshold: 50 },  renown: 600,  sprite: 'deed_end_50' },
  { id: 'end_100', category: 'depth', name: 'The Deep Dark', desc: 'Reach Endless floor 100.', requirement: { kind: 'endlessFloor', threshold: 100 }, renown: 1000, sprite: 'deed_end_100' },

  // ── BOUNTY — lifetime contracts completed across every hero ──
  { id: 'bnt_1',   category: 'bounty', name: 'Contractor',   desc: 'Complete your first bounty.', requirement: { kind: 'bountyTotal', threshold: 1 },   renown: 30,  sprite: 'deed_bnt_1' },
  { id: 'bnt_10',  category: 'bounty', name: 'Hired Blade',  desc: 'Complete 10 bounties.',       requirement: { kind: 'bountyTotal', threshold: 10 },  renown: 100, sprite: 'deed_bnt_10' },
  { id: 'bnt_25',  category: 'bounty', name: 'Bounty Hunter',desc: 'Complete 25 bounties.',       requirement: { kind: 'bountyTotal', threshold: 25 },  renown: 220, sprite: 'deed_bnt_25' },
  { id: 'bnt_50',  category: 'bounty', name: 'Contract Killer',desc: 'Complete 50 bounties.',     requirement: { kind: 'bountyTotal', threshold: 50 },  renown: 400, sprite: 'deed_bnt_50' },
  { id: 'bnt_100', category: 'bounty', name: 'Guild Legend', desc: 'Complete 100 bounties.',      requirement: { kind: 'bountyTotal', threshold: 100 }, renown: 750, sprite: 'deed_bnt_100' },

  // ── BREADTH — distinct classes ever levelled (rewards playing the whole roster) ──
  { id: 'brd_2', category: 'breadth', name: 'Versatile',   desc: 'Level 2 different classes.', requirement: { kind: 'classesPlayed', threshold: 2 }, renown: 80,  sprite: 'deed_brd_2' },
  { id: 'brd_4', category: 'breadth', name: 'Polymath',    desc: 'Level 4 different classes.', requirement: { kind: 'classesPlayed', threshold: 4 }, renown: 200, sprite: 'deed_brd_4' },
  { id: 'brd_6', category: 'breadth', name: 'Jack of All', desc: 'Level 6 different classes.', requirement: { kind: 'classesPlayed', threshold: 6 }, renown: 400, sprite: 'deed_brd_6' },

  // ── MASTERY — deep-endgame crafting: items forged in the Mirrorforge ──
  { id: 'mir_1',  category: 'mastery', name: 'Mirrorforged',  desc: 'Mirror your first item.', requirement: { kind: 'mirrored', threshold: 1 },  renown: 100, sprite: 'deed_mir_1' },
  { id: 'mir_10', category: 'mastery', name: 'Reflectionist', desc: 'Mirror 10 items.',        requirement: { kind: 'mirrored', threshold: 10 }, renown: 300, sprite: 'deed_mir_10' },
  { id: 'mir_25', category: 'mastery', name: 'Master Forger', desc: 'Mirror 25 items.',        requirement: { kind: 'mirrored', threshold: 25 }, renown: 600, sprite: 'deed_mir_25' },
];
