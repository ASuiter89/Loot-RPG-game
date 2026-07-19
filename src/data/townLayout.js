// Authored STATIC town — the adventurers' base CAMP, hand-placed and identical
// every visit. Pure data (no logic): a fixed 30×22 forest clearing. Coordinates are
// tiles; src/systems/townLayout.js turns them into walkable-grid queries and
// src/legacy/game.js (buildTown) stamps them into mapData/decorMap/furnitureMap and
// places the keepers. NO procedural generation — same camp on every entry.
//
// Layout: a clearing framed by a treeline (short trees on the border, bushes
// filling), gapped at the gate up top and the arrival down below. A central
// CAMPFIRE ringed with logs & stumps to sit on is the social hub; worn DIRT trails
// wind out to the keepers, who are SCATTERED organically across the green (no grid).
// The late-game keepers gather in their own ENDGAME SANCTUM — a hedged grove in the
// top-left with a single south doorway. A signpost greets you at the entrance and a
// well sits off to one side. Every keeper is kept CLEAR of the tree canopies
// (verified in test), so none is ever hidden behind one. buildTown() only PLACES a
// keeper once its service is unlocked, so a locked keeper simply hasn't "arrived" in
// town yet (and a newly-arrived one gets an exclamation mark until you greet it).

export const TOWN_W = 30;
export const TOWN_H = 22;

// Arrival tile (bottom-centre, on the entrance trail — used on a death revive or a
// reload that resumes in town) and the two exits.
export const TOWN_SPAWN = { x: 15, y: 19 };
export const TOWN_GATE = { x: 15, y: 2, name: 'Dungeon Gate' };     // walk in / interact to descend
// The return portal sits mid-clearing on the central avenue (NOT tucked at the
// bottom): when you portal in with a floor held you step out ONTO this tile, so the
// way home is right where you land. Shown/interactable only when a floor is held.
export const TOWN_PORTAL = { x: 15, y: 15, name: 'Town Portal' };

// Keepers, scattered organically (no grid lines). `kind` maps 1:1 to
// openTownService(kind); `name` is the label + prompt text. The six late-game
// keepers cluster INSIDE the hedged endgame sanctum (top-left grove); the rest are
// spread loosely across the open clearing.
export const TOWN_NPCS = [
  // Endgame sanctum — the hedged grove (top-left), reached through its south gap.
  // The grove sits one tile up so its top wall butts against the treeline (no walkable
  // gap above it for a keeper to get stranded in); keep these in sync with the hedges.
  { x: 5, y: 3, kind: 'covenants', name: 'Covenant Altar' },
  { x: 8, y: 4, kind: 'weave', name: 'Ascendant Weave' },
  { x: 10, y: 6, kind: 'pantheon', name: 'Pantheon' },
  { x: 4, y: 5, kind: 'mirrorforge', name: 'Mirrorforge' },
  { x: 6, y: 7, kind: 'deeds', name: 'Hall of Deeds' },
  { x: 9, y: 8, kind: 'cycles', name: 'Cycles' },
  // Regular services, scattered organically across the clearing.
  { x: 16, y: 5, kind: 'trainer', name: 'Trainer' },
  { x: 22, y: 4, kind: 'merchant', name: 'Merchant' },
  { x: 13, y: 6, kind: 'stash', name: 'Vault' },
  { x: 19, y: 7, kind: 'ramen', name: 'Ramen House' },
  { x: 25, y: 7, kind: 'healer', name: 'Healer' },
  { x: 21, y: 11, kind: 'gambler', name: 'Gambler' },
  // The Craftsman stands just OFF the central avenue, up-left of the Town Portal
  // (15,15) — pinned and never wandering (see TOWN_FIXED_KINDS) so it's right by where
  // a returning hero lands, but sits beside the path (not on it) so it never blocks the
  // walkway. A path tile is orthogonally adjacent, so it's still greeted in one step.
  { x: 12, y: 12, kind: 'forge', name: 'Craftsman' },
  { x: 9, y: 12, kind: 'prospector', name: 'Prospector' },
  { x: 24, y: 14, kind: 'bounty', name: 'Bounty Board' },
  { x: 4, y: 16, kind: 'transmuter', name: 'Transmuter' },
  { x: 20, y: 16, kind: 'enchanter', name: 'Enchanter' },
  { x: 12, y: 17, kind: 'sellsword', name: 'Sellsword' },
];

// Worn dirt trails (list of tiles). Everything else interior is grass. Rendered as
// a real autotiled Dirt terrain (buildTown marks these variant-2 for the floor3 role).
// The avenue runs spawn → gate; a loop threads the clearing out to the sanctum
// doorway, the market, the forge and the civic well.
export const TOWN_PATHS = [
  { x: 15, y: 19 }, { x: 15, y: 18 }, { x: 15, y: 17 }, { x: 15, y: 16 }, { x: 15, y: 15 }, { x: 15, y: 14 }, { x: 15, y: 13 }, { x: 15, y: 12 }, { x: 15, y: 11 }, { x: 15, y: 10 },
  { x: 15, y: 9 }, { x: 15, y: 8 }, { x: 15, y: 7 }, { x: 15, y: 6 }, { x: 15, y: 5 }, { x: 15, y: 4 }, { x: 15, y: 3 }, { x: 12, y: 19 }, { x: 13, y: 19 }, { x: 14, y: 19 },
  { x: 7, y: 11 }, { x: 8, y: 11 }, { x: 9, y: 11 }, { x: 10, y: 11 }, { x: 11, y: 11 }, { x: 12, y: 11 }, { x: 13, y: 11 }, { x: 14, y: 11 }, { x: 16, y: 11 }, { x: 17, y: 11 },
  { x: 18, y: 11 }, { x: 19, y: 11 }, { x: 20, y: 11 }, { x: 21, y: 11 }, { x: 22, y: 11 }, { x: 23, y: 11 }, { x: 24, y: 11 }, { x: 24, y: 12 }, { x: 14, y: 13 }, { x: 13, y: 13 },
  { x: 12, y: 13 }, { x: 11, y: 13 }, { x: 10, y: 13 }, { x: 9, y: 13 }, { x: 8, y: 13 }, { x: 7, y: 13 }, { x: 7, y: 14 }, { x: 24, y: 13 }, { x: 24, y: 14 }, { x: 16, y: 6 },
  { x: 17, y: 6 }, { x: 18, y: 6 }, { x: 19, y: 6 }, { x: 20, y: 6 }, { x: 21, y: 6 }, { x: 22, y: 6 }, { x: 22, y: 5 }, { x: 7, y: 12 },
];

// Scenery. Each entry is an EXACT atlas piece `{x,y,id}` (the campfire, well, sign,
// and the logs/stumps around the fire) or a FAMILY `{x,y,c}` that buildTown resolves
// to a curated piece deterministically. Landmarks + fire seating first, then the
// endgame-sanctum hedge walls (with a south doorway gap), then scattered camp props,
// then the treeline (border trees + non-occluding bushes).
export const TOWN_DECOR = [
  // Landmarks: central campfire + fire-ring seating, well, signpost. The four seat
  // logs ring the fire at its corners, kept OFF the walkable trails (the y:11 path and
  // the avenue run between them) so no stump ever sits on a path.
  { x: 15, y: 10, id: 180 }, { x: 13, y: 9, c: 'L' }, { x: 17, y: 9, c: 'L' }, { x: 13, y: 12, c: 'L' }, { x: 17, y: 12, c: 'L' }, { x: 23, y: 12, id: 190 }, { x: 13, y: 18, id: 63 },
  // Endgame sanctum hedge walls ('h'), shifted up one tile so the top wall (y:2) butts
  // against the treeline — no walkable row above the grove. Doorway gap on the south
  // side (at x:7,y:9).
  { x: 3, y: 2, c: 'h' }, { x: 3, y: 9, c: 'h' }, { x: 4, y: 2, c: 'h' }, { x: 4, y: 9, c: 'h' }, { x: 5, y: 2, c: 'h' }, { x: 5, y: 9, c: 'h' }, { x: 6, y: 2, c: 'h' }, { x: 6, y: 9, c: 'h' }, { x: 7, y: 2, c: 'h' }, { x: 8, y: 2, c: 'h' }, { x: 8, y: 9, c: 'h' }, { x: 9, y: 2, c: 'h' }, { x: 9, y: 9, c: 'h' }, { x: 10, y: 2, c: 'h' }, { x: 10, y: 9, c: 'h' }, { x: 11, y: 2, c: 'h' }, { x: 11, y: 9, c: 'h' }, { x: 3, y: 3, c: 'h' }, { x: 11, y: 3, c: 'h' }, { x: 3, y: 4, c: 'h' }, { x: 11, y: 4, c: 'h' }, { x: 3, y: 5, c: 'h' }, { x: 11, y: 5, c: 'h' }, { x: 3, y: 6, c: 'h' }, { x: 11, y: 6, c: 'h' }, { x: 3, y: 7, c: 'h' }, { x: 11, y: 7, c: 'h' }, { x: 3, y: 8, c: 'h' }, { x: 11, y: 8, c: 'h' },
  // Camp props (flowers/grass/potted/rugs walkable; barrels/crates solid).
  { x: 6, y: 4, c: 'r' }, { x: 8, y: 7, c: 'p' }, { x: 4, y: 8, c: 'f' }, { x: 10, y: 3, c: 'p' }, { x: 7, y: 5, c: 'r' }, { x: 21, y: 5, c: 'o' }, { x: 23, y: 6, c: 'c' }, { x: 20, y: 4, c: 'f' },
  { x: 27, y: 6, c: 'g' }, { x: 18, y: 7, c: 'p' }, { x: 24, y: 9, c: 'o' }, { x: 26, y: 5, c: 'f' }, { x: 12, y: 5, c: 'f' }, { x: 14, y: 5, c: 'g' }, { x: 16, y: 6, c: 'f' }, { x: 18, y: 4, c: 'g' },
  { x: 6, y: 12, c: 'c' }, { x: 8, y: 14, c: 'p' }, { x: 5, y: 15, c: 'f' }, { x: 9, y: 16, c: 'g' }, { x: 22, y: 14, c: 'o' }, { x: 25, y: 15, c: 'c' }, { x: 19, y: 15, c: 'p' }, { x: 21, y: 17, c: 'f' },
  { x: 11, y: 16, c: 'g' }, { x: 13, y: 16, c: 'f' }, { x: 3, y: 17, c: 'g' }, { x: 5, y: 17, c: 'f' }, { x: 16, y: 15, c: 'f' }, { x: 15, y: 14, c: 'g' }, { x: 17, y: 13, c: 'f' },
  // Treeline: short border trees + non-occluding bushes (framing the clearing).
  { x: 1, y: 1, c: 'T' }, { x: 1, y: 20, c: 'T' }, { x: 2, y: 1, c: 'T' }, { x: 2, y: 20, c: 'T' }, { x: 3, y: 1, c: 'a' }, { x: 3, y: 20, c: 't' }, { x: 4, y: 1, c: 'T' }, { x: 4, y: 20, c: 'T' }, { x: 5, y: 1, c: 'T' }, { x: 5, y: 20, c: 'T' },
  { x: 6, y: 1, c: 't' }, { x: 6, y: 20, c: 'a' }, { x: 7, y: 1, c: 'T' }, { x: 7, y: 20, c: 'T' }, { x: 8, y: 1, c: 'T' }, { x: 8, y: 20, c: 'T' }, { x: 9, y: 1, c: 'a' }, { x: 9, y: 20, c: 't' }, { x: 10, y: 1, c: 'T' }, { x: 10, y: 20, c: 'T' },
  { x: 11, y: 1, c: 'T' }, { x: 12, y: 1, c: 't' }, { x: 18, y: 1, c: 't' }, { x: 18, y: 20, c: 'a' }, { x: 19, y: 1, c: 'T' }, { x: 19, y: 20, c: 'T' }, { x: 20, y: 1, c: 'T' }, { x: 20, y: 20, c: 'T' }, { x: 21, y: 1, c: 'a' }, { x: 21, y: 20, c: 't' },
  { x: 22, y: 1, c: 'T' }, { x: 22, y: 20, c: 'T' }, { x: 23, y: 1, c: 'T' }, { x: 23, y: 20, c: 'T' }, { x: 24, y: 1, c: 't' }, { x: 24, y: 20, c: 'a' }, { x: 25, y: 1, c: 'T' }, { x: 25, y: 20, c: 'T' }, { x: 26, y: 1, c: 'T' }, { x: 26, y: 20, c: 'T' },
  { x: 27, y: 1, c: 'a' }, { x: 27, y: 20, c: 't' }, { x: 28, y: 1, c: 'T' }, { x: 28, y: 20, c: 'T' }, { x: 1, y: 2, c: 'T' }, { x: 28, y: 2, c: 'T' }, { x: 1, y: 3, c: 'T' }, { x: 28, y: 3, c: 'T' }, { x: 1, y: 4, c: 'T' }, { x: 28, y: 4, c: 'T' },
  { x: 1, y: 5, c: 'T' }, { x: 28, y: 5, c: 'T' }, { x: 1, y: 6, c: 'T' }, { x: 28, y: 6, c: 'T' }, { x: 1, y: 7, c: 'T' }, { x: 28, y: 7, c: 'T' }, { x: 1, y: 8, c: 'T' }, { x: 28, y: 8, c: 'T' }, { x: 1, y: 9, c: 'T' }, { x: 28, y: 9, c: 'T' },
  { x: 1, y: 10, c: 'T' }, { x: 28, y: 10, c: 'T' }, { x: 1, y: 11, c: 'T' }, { x: 28, y: 11, c: 'T' }, { x: 1, y: 12, c: 'T' }, { x: 28, y: 12, c: 'T' }, { x: 1, y: 13, c: 'T' }, { x: 28, y: 13, c: 'T' }, { x: 1, y: 14, c: 'T' }, { x: 28, y: 14, c: 'T' },
  { x: 1, y: 15, c: 'T' }, { x: 28, y: 15, c: 'T' }, { x: 1, y: 16, c: 'T' }, { x: 28, y: 16, c: 'T' }, { x: 1, y: 17, c: 'T' }, { x: 28, y: 17, c: 'T' }, { x: 1, y: 18, c: 'T' }, { x: 28, y: 18, c: 'T' }, { x: 1, y: 19, c: 'T' }, { x: 28, y: 19, c: 'T' },
  { x: 4, y: 19, c: 'b' }, { x: 6, y: 19, c: 'b' }, { x: 8, y: 19, c: 'b' }, { x: 10, y: 19, c: 'b' }, { x: 18, y: 19, c: 'b' }, { x: 20, y: 19, c: 'b' }, { x: 22, y: 19, c: 'b' }, { x: 24, y: 19, c: 'b' }, { x: 26, y: 19, c: 'b' }, { x: 2, y: 4, c: 'b' },
  { x: 27, y: 4, c: 'b' }, { x: 27, y: 6, c: 'b' }, { x: 27, y: 8, c: 'b' }, { x: 27, y: 10, c: 'b' }, { x: 2, y: 12, c: 'b' }, { x: 27, y: 12, c: 'b' }, { x: 27, y: 14, c: 'b' }, { x: 27, y: 16, c: 'b' }, { x: 2, y: 18, c: 'b' },
];

// ── SERVICE UNLOCK ORDER ──────────────────────────────────────────────────────
// The town is a CAMP that fills in its keepers as the hero proves themselves against
// the dungeon's guardians. Each keeper has an ARRIVAL number: it joins once that many
// distinct boss floors have been first-cleared (the floor-5 guardian is boss #1, floor
// 10 is #2, …). Arrival 1 IS the town-unlock: before the floor-5 guardian falls the
// camp offers no services and the Town Portal is sealed.
//   The two FOUNDING keepers — the HEALER and the CRAFTSMAN — SHARE arrival 1, so the
//   very first town visit already has both. Besides forging blank gear, the Craftsman
//   CRAFTS the HUD "Field Kit" (the minimap, counters, depth/difficulty labels and
//   vital numbers you build a bare heads-up display out of; see src/data/hudUpgrades.js),
//   so those readout tools are on hand from the first visit. Every OTHER keeper keeps
//   its own arrival number below and joins one-per-boss (the two founders share #1, so
//   boss #2 lands no one new — the next keeper, the Merchant, joins on boss #3):
//   1 Healer + Craftsman   — the two founders, from the town-unlock (boss floor 5)
//   3 Merchant · 4 Vault   — the other essentials (boss floors 15–20)
//   5 Ramen House · 6 Prospector · 7 Trainer
//   8 Gambler · 9 Enchanter · 10 Bounty Board
//   11 Transmuter · 12 Sellsword
//   13 Ascendant Weave · 14 Cycles · 15 Hall of Deeds   — endgame sanctum
//   16 Covenant Altar · 17 Mirrorforge · 18 Pantheon    — the deepest keepers
export const TOWN_SERVICE_ARRIVALS = {
  healer: 1, forge: 1, merchant: 3, stash: 4,
  ramen: 5, prospector: 6, trainer: 7,
  gambler: 8, enchanter: 9, bounty: 10,
  transmuter: 11, sellsword: 12,
  weave: 13, cycles: 14, deeds: 15,
  covenants: 16, mirrorforge: 17, pantheon: 18,
};

// The late-game keepers who gather in the hedged ENDGAME SANCTUM (top-left grove).
// They keep their AUTHORED sanctum tiles and never wander — the regular keepers out
// in the open clearing are the ones who get randomized spots and stroll about.
export const TOWN_ENDGAME_KINDS = ['covenants', 'weave', 'pantheon', 'mirrorforge', 'deeds', 'cycles'];

// Regular (non-sanctum) keepers PINNED to their authored tile — they take the exact
// spot above every visit and never wander, so the hero always finds them in the same
// place. The Craftsman is pinned just off the avenue beside the Town Portal: it's the
// keeper you return to constantly (forging gear, crafting the HUD Field Kit), so it
// must never wander off where a hero could lose it — but it sits BESIDE the path, not
// on it, so it never blocks the walkway. buildTown places these at n.x/n.y with
// wander=false and reserves their tile from the wander free-set.
export const TOWN_FIXED_KINDS = ['forge'];

// Bounding box (inclusive tile coords) of the hedged endgame sanctum — the grove the
// six endgame keepers occupy, walled by the hedge with a single south doorway. This
// is the one region a wandering regular keeper must NEVER stroll into: buildTown
// blocks it from the wander free-set, and updateTownNpcs double-guards on it, so the
// open-clearing folk keep out of the endgame grove. Keep it covering every hedge tile
// and every endgame-keeper tile (a data test enforces both).
export const TOWN_SANCTUM = { x0: 3, y0: 2, x1: 11, y1: 9 };

// Slow-stroll tuning for the wandering regular keepers (buildTown + updateTownNpcs).
// speed in tiles/sec (unhurried amble); radius is how far (Chebyshev) a keeper drifts
// from its arrival spot; dwell is the pause (seconds) between steps.
export const TOWN_WANDER = { speed: 1.1, radius: 3, dwellMin: 0.7, dwellMax: 2.6, walkChance: 0.8 };

// Family char → { ids (curated DECOR_INDEX pieces), solid }. buildTown picks one id
// per placement deterministically (pickDecorVariant). Border trees are kept SHORT
// (ht ≤ ~3.8) so their canopies never reach the keepers. Bushes/hedges block but do
// NOT occlude (fully solid), so they fill the treeline and wall the sanctum without
// hiding anything behind.
export const TOWN_DECOR_FAMILIES = {
  T: { ids: [93, 94], solid: true },                    // short green trees
  a: { ids: [101, 102], solid: true },                  // short autumn trees
  t: { ids: [116], solid: true },                       // short pine
  b: { ids: [89, 90, 91], solid: true },                // full bushes (treeline fill)
  h: { ids: [92], solid: true },                        // small hedge bush (sanctum walls)
  L: { ids: [66, 59, 60], solid: true },                // logs & stumps (fire seating)
  o: { ids: [147, 148, 150, 151], solid: true },        // barrels
  c: { ids: [161, 162, 153], solid: true },             // crates / boxes
  f: { ids: [2, 3, 4, 5, 6, 7, 9, 12, 13], solid: false }, // flowers
  g: { ids: [24, 25, 26, 27, 14, 15], solid: false },   // grass tufts / reeds
  p: { ids: [182, 183, 184, 186, 188], solid: false },  // potted plants
  r: { ids: [201, 204, 205, 199, 203], solid: false },  // market mats / rugs
};
