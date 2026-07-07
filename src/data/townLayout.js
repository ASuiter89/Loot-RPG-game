// Authored STATIC town — the adventurers' base CAMP, hand-placed and identical
// every visit. Pure data (no logic): a fixed 30×22 forest clearing. Coordinates are
// tiles; src/systems/townLayout.js turns them into walkable-grid queries and
// src/legacy/game.js (buildTown) stamps them into mapData/decorMap/furnitureMap and
// places the keepers. NO procedural generation — same camp on every entry.
//
// Layout: a clearing framed by a treeline (short trees on the border, bushes
// filling), gapped at the gate up top and the arrival down below. A central
// CAMPFIRE ringed with logs & stumps to sit on is the social hub; worn DIRT trails
// wind out to five trade "camps" of keepers, each with its own props; a signpost
// greets you at the entrance and a well sits off to one side. Every keeper is kept
// CLEAR of the tree canopies (verified in test), so none is ever hidden behind one.

export const TOWN_W = 30;
export const TOWN_H = 22;

// Arrival tile (bottom-centre, on the entrance trail) and the two exits.
export const TOWN_SPAWN = { x: 15, y: 19 };
export const TOWN_GATE = { x: 15, y: 2, name: 'Dungeon Gate' };     // walk in / interact to descend
export const TOWN_PORTAL = { x: 12, y: 19, name: 'Town Portal' };   // shown only when a floor is held

// Worn dirt trails (list of tiles). Everything else interior is grass. Rendered as
// a real autotiled Dirt terrain (buildTown marks these variant-2 for the floor3 role).
export const TOWN_PATHS = [
  { x: 13, y: 17 }, { x: 14, y: 17 }, { x: 15, y: 17 }, { x: 16, y: 17 }, { x: 17, y: 17 }, { x: 13, y: 18 }, { x: 14, y: 18 }, { x: 15, y: 18 }, { x: 16, y: 18 }, { x: 17, y: 18 }, { x: 13, y: 19 }, { x: 14, y: 19 }, { x: 15, y: 19 }, { x: 16, y: 19 }, { x: 17, y: 19 }, { x: 15, y: 16 }, { x: 15, y: 15 }, { x: 15, y: 14 }, { x: 15, y: 13 }, { x: 15, y: 12 }, { x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }, { x: 16, y: 8 }, { x: 17, y: 8 }, { x: 18, y: 8 }, { x: 12, y: 9 }, { x: 13, y: 9 }, { x: 14, y: 9 }, { x: 15, y: 9 }, { x: 16, y: 9 }, { x: 17, y: 9 }, { x: 18, y: 9 }, { x: 12, y: 10 }, { x: 13, y: 10 }, { x: 14, y: 10 }, { x: 15, y: 10 }, { x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }, { x: 12, y: 11 }, { x: 13, y: 11 }, { x: 14, y: 11 }, { x: 15, y: 11 }, { x: 16, y: 11 }, { x: 17, y: 11 }, { x: 18, y: 11 }, { x: 12, y: 12 }, { x: 13, y: 12 }, { x: 14, y: 12 }, { x: 16, y: 12 }, { x: 17, y: 12 }, { x: 18, y: 12 }, { x: 15, y: 7 }, { x: 15, y: 6 }, { x: 15, y: 5 }, { x: 15, y: 4 }, { x: 15, y: 3 }, { x: 10, y: 9 }, { x: 8, y: 8 }, { x: 7, y: 7 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 7, y: 9 }, { x: 6, y: 10 }, { x: 20, y: 9 }, { x: 22, y: 8 }, { x: 23, y: 7 }, { x: 23, y: 6 }, { x: 22, y: 5 }, { x: 23, y: 9 }, { x: 24, y: 9 }, { x: 10, y: 13 }, { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 }, { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 15 }, { x: 20, y: 13 }, { x: 22, y: 14 }, { x: 23, y: 14 }, { x: 23, y: 13 }, { x: 22, y: 12 }, { x: 24, y: 14 }, { x: 24, y: 15 }, { x: 12, y: 5 }, { x: 13, y: 5 }, { x: 17, y: 4 }, { x: 18, y: 4 },
];

// Keepers in five trade camps, loosely clustered and offset off the grid lines.
// `kind` maps 1:1 to openTownService(kind); `name` is the label + prompt text.
export const TOWN_NPCS = [
  // arcane camp — north-west
  { x: 5, y: 5, kind: 'mystic', name: 'Mystic' },
  { x: 9, y: 4, kind: 'covenants', name: 'Covenant Altar' },
  { x: 5, y: 8, kind: 'weave', name: 'Ascendant Weave' },
  { x: 9, y: 8, kind: 'pantheon', name: 'Pantheon' },
  // market camp — north-east
  { x: 21, y: 5, kind: 'merchant', name: 'Merchant' },
  { x: 25, y: 6, kind: 'gambler', name: 'Gambler' },
  { x: 21, y: 8, kind: 'ramen', name: 'Ramen House' },
  { x: 25, y: 9, kind: 'healer', name: 'Healer' },
  // by the gate — top centre
  { x: 12, y: 5, kind: 'stash', name: 'Vault' },
  { x: 18, y: 4, kind: 'trainer', name: 'Trainer' },
  // craft camp — south-west
  { x: 5, y: 12, kind: 'forge', name: 'Craftsman' },
  { x: 9, y: 11, kind: 'enchanter', name: 'Enchanter' },
  { x: 5, y: 15, kind: 'transmuter', name: 'Transmuter' },
  { x: 9, y: 14, kind: 'mirrorforge', name: 'Mirrorforge' },
  // civic camp — south-east
  { x: 21, y: 12, kind: 'bounty', name: 'Bounty Board' },
  { x: 25, y: 12, kind: 'sellsword', name: 'Sellsword' },
  { x: 21, y: 15, kind: 'deeds', name: 'Hall of Deeds' },
  { x: 25, y: 14, kind: 'cycles', name: 'Cycles' },
];

// Scenery. Each entry is an EXACT atlas piece `{x,y,id}` (the campfire, well, sign,
// and the logs/stumps around the fire) or a FAMILY `{x,y,c}` that buildTown resolves
// to a curated piece deterministically. First landmarks + fire seating, then per-camp
// props + walkable flowers/tufts, then the treeline (border trees + non-occluding bushes).
export const TOWN_DECOR = [
  { x: 15, y: 10, id: 180 }, { x: 22, y: 13, id: 190 }, { x: 13, y: 17, id: 63 },
  { x: 13, y: 9, c: 'L' }, { x: 17, y: 9, c: 'L' }, { x: 13, y: 11, c: 'L' }, { x: 17, y: 11, c: 'L' }, { x: 15, y: 12, c: 'L' },
  { x: 4, y: 6, c: 'c' }, { x: 8, y: 6, c: 'c' }, { x: 24, y: 5, c: 'o' }, { x: 20, y: 7, c: 'o' }, { x: 4, y: 11, c: 'c' }, { x: 8, y: 15, c: 'c' }, { x: 20, y: 11, c: 'o' }, { x: 23, y: 8, c: 'p' }, { x: 6, y: 13, c: 'p' }, { x: 23, y: 12, c: 'p' }, { x: 16, y: 15, c: 'r' }, { x: 18, y: 15, c: 'r' },
  { x: 7, y: 5, c: 'f' }, { x: 23, y: 6, c: 'f' }, { x: 7, y: 13, c: 'f' }, { x: 23, y: 14, c: 'f' }, { x: 11, y: 7, c: 'f' }, { x: 19, y: 7, c: 'f' }, { x: 11, y: 13, c: 'f' }, { x: 19, y: 13, c: 'f' }, { x: 13, y: 14, c: 'f' }, { x: 17, y: 14, c: 'f' }, { x: 10, y: 6, c: 'g' }, { x: 20, y: 6, c: 'g' }, { x: 20, y: 14, c: 'g' }, { x: 15, y: 15, c: 'g' },
  { x: 1, y: 1, c: 'T' }, { x: 1, y: 20, c: 'T' }, { x: 2, y: 1, c: 'T' }, { x: 2, y: 20, c: 'T' }, { x: 3, y: 1, c: 'a' }, { x: 3, y: 20, c: 't' }, { x: 4, y: 1, c: 'T' }, { x: 4, y: 20, c: 'T' }, { x: 5, y: 1, c: 'T' }, { x: 5, y: 20, c: 'T' }, { x: 6, y: 1, c: 't' }, { x: 6, y: 20, c: 'a' }, { x: 7, y: 1, c: 'T' }, { x: 7, y: 20, c: 'T' }, { x: 8, y: 1, c: 'T' }, { x: 8, y: 20, c: 'T' }, { x: 9, y: 1, c: 'a' }, { x: 9, y: 20, c: 't' }, { x: 10, y: 1, c: 'T' }, { x: 10, y: 20, c: 'T' }, { x: 11, y: 1, c: 'T' }, { x: 12, y: 1, c: 't' }, { x: 18, y: 1, c: 't' }, { x: 18, y: 20, c: 'a' }, { x: 19, y: 1, c: 'T' }, { x: 19, y: 20, c: 'T' }, { x: 20, y: 1, c: 'T' }, { x: 20, y: 20, c: 'T' }, { x: 21, y: 1, c: 'a' }, { x: 21, y: 20, c: 't' }, { x: 22, y: 1, c: 'T' }, { x: 22, y: 20, c: 'T' }, { x: 23, y: 1, c: 'T' }, { x: 23, y: 20, c: 'T' }, { x: 24, y: 1, c: 't' }, { x: 24, y: 20, c: 'a' }, { x: 25, y: 1, c: 'T' }, { x: 25, y: 20, c: 'T' }, { x: 26, y: 1, c: 'T' }, { x: 26, y: 20, c: 'T' }, { x: 27, y: 1, c: 'a' }, { x: 27, y: 20, c: 't' }, { x: 28, y: 1, c: 'T' }, { x: 28, y: 20, c: 'T' }, { x: 1, y: 2, c: 'T' }, { x: 28, y: 2, c: 'T' }, { x: 1, y: 3, c: 'T' }, { x: 28, y: 3, c: 'T' }, { x: 1, y: 4, c: 'T' }, { x: 28, y: 4, c: 'T' }, { x: 1, y: 5, c: 'T' }, { x: 28, y: 5, c: 'T' }, { x: 1, y: 6, c: 'T' }, { x: 28, y: 6, c: 'T' }, { x: 1, y: 7, c: 'T' }, { x: 28, y: 7, c: 'T' }, { x: 1, y: 8, c: 'T' }, { x: 28, y: 8, c: 'T' }, { x: 1, y: 9, c: 'T' }, { x: 28, y: 9, c: 'T' }, { x: 1, y: 10, c: 'T' }, { x: 28, y: 10, c: 'T' }, { x: 1, y: 11, c: 'T' }, { x: 28, y: 11, c: 'T' }, { x: 1, y: 12, c: 'T' }, { x: 28, y: 12, c: 'T' }, { x: 1, y: 13, c: 'T' }, { x: 28, y: 13, c: 'T' }, { x: 1, y: 14, c: 'T' }, { x: 28, y: 14, c: 'T' }, { x: 1, y: 15, c: 'T' }, { x: 28, y: 15, c: 'T' }, { x: 1, y: 16, c: 'T' }, { x: 28, y: 16, c: 'T' }, { x: 1, y: 17, c: 'T' }, { x: 28, y: 17, c: 'T' }, { x: 1, y: 18, c: 'T' }, { x: 28, y: 18, c: 'T' }, { x: 1, y: 19, c: 'T' }, { x: 28, y: 19, c: 'T' },
  { x: 4, y: 19, c: 'b' }, { x: 6, y: 19, c: 'b' }, { x: 8, y: 19, c: 'b' }, { x: 10, y: 19, c: 'b' }, { x: 18, y: 19, c: 'b' }, { x: 20, y: 19, c: 'b' }, { x: 22, y: 19, c: 'b' }, { x: 24, y: 19, c: 'b' }, { x: 26, y: 19, c: 'b' }, { x: 2, y: 4, c: 'b' }, { x: 27, y: 4, c: 'b' }, { x: 27, y: 6, c: 'b' }, { x: 27, y: 8, c: 'b' }, { x: 27, y: 10, c: 'b' }, { x: 2, y: 12, c: 'b' }, { x: 27, y: 12, c: 'b' }, { x: 27, y: 14, c: 'b' }, { x: 27, y: 16, c: 'b' }, { x: 2, y: 18, c: 'b' },
];

// Family char → { ids (curated DECOR_INDEX pieces), solid }. buildTown picks one id
// per placement deterministically (pickDecorVariant). Border trees are kept SHORT
// (ht ≤ ~3.8) so their canopies never reach the keepers. Bushes block but do NOT
// occlude (fully solid), so they fill the treeline without hiding anything behind.
export const TOWN_DECOR_FAMILIES = {
  T: { ids: [93, 94], solid: true },                    // short green trees
  a: { ids: [101, 102], solid: true },                  // short autumn trees
  t: { ids: [116], solid: true },                       // short pine
  b: { ids: [89, 90, 91], solid: true },                // full bushes (treeline fill)
  h: { ids: [92], solid: true },                        // small hedge bush
  L: { ids: [66, 59, 60], solid: true },                // logs & stumps (fire seating)
  o: { ids: [147, 148, 150, 151], solid: true },        // barrels
  c: { ids: [161, 162, 153], solid: true },             // crates / boxes
  f: { ids: [2, 3, 4, 5, 6, 7, 9, 12, 13], solid: false }, // flowers
  g: { ids: [24, 25, 26, 27, 14, 15], solid: false },   // grass tufts / reeds
  p: { ids: [182, 183, 184, 186, 188], solid: false },  // potted plants
  r: { ids: [201, 204, 205, 199, 203], solid: false },  // market mats / rugs
};
