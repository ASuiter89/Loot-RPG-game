// Authored STATIC town — the safe hub, hand-placed and identical every visit.
// Pure data (no logic): the walkable town is a fixed 30×22 tile plaza. Everything
// here is tile coordinates; src/systems/townLayout.js turns it into walkable-grid
// queries and src/legacy/game.js (buildTown) stamps it into mapData/decorMap and
// places the service keepers. There is NO procedural generation — the town is the
// same layout on every entry.
//
// Design: a wooded village green ringed by trees, a central plaza around a statue,
// a lamp-lined avenue running from the Dungeon Gate (top) down to where you arrive
// (bottom), and four organic districts of service keepers among the greenery:
//   • craft quarter  (upper-left)  — Craftsman, Enchanter, Transmuter, Mirrorforge
//   • market         (upper-right) — Merchant, Gambler, Ramen House
//   • arcane grove   (lower-left)  — Mystic, Covenant Altar, Ascendant Weave, Pantheon
//   • civic green    (lower-right) — Healer, Trainer, Bounty Board, Hall of Deeds, Cycles
// plus the Vault and Sellsword flanking the plaza. No buildings — keepers stand in
// the open among their wares and the greenery.

export const TOWN_W = 30;
export const TOWN_H = 22;

// Where the hero materialises on arrival (bottom-centre, by the gate avenue).
export const TOWN_SPAWN = { x: 15, y: 18 };
// The plaza centrepiece — a stone statue (feat_statue), purely decorative.
export const TOWN_STATUE = { x: 15, y: 11 };
// The Dungeon Gate: walk into it (or interact) to open the descent picker.
export const TOWN_GATE = { x: 15, y: 2, name: 'Dungeon Gate' };
// The Town Portal home: appears ONLY when a floor is held (you portaled or
// conquered your way to town); interact to drop back onto the floor you left.
export const TOWN_PORTAL = { x: 12, y: 18, name: 'Town Portal' };

// Cobblestone walkways (rects, {x,y,w,h}); everything else interior is grass.
export const TOWN_PATHS = [
  { x: 14, y: 2, w: 2, h: 18 },   // vertical avenue: Dungeon Gate → arrival
  { x: 3, y: 11, w: 24, h: 1 },   // main east–west avenue
  { x: 4, y: 6, w: 22, h: 1 },    // upper cross-street (craft ↔ market)
  { x: 4, y: 15, w: 22, h: 1 },   // lower cross-street (grove ↔ civic)
  { x: 11, y: 9, w: 8, h: 5 },    // central plaza around the statue
];

// Service keepers. `kind` maps 1:1 to openTownService(kind); `name` is the label
// shown over the keeper and in the interaction prompt. Locked services (gated on
// progression via TOWN_MENU) still stand here — greyed, with the unlock hint.
export const TOWN_NPCS = [
  // craft quarter (upper-left)
  { x: 4, y: 5, kind: 'forge', name: 'Craftsman' },
  { x: 8, y: 5, kind: 'enchanter', name: 'Enchanter' },
  { x: 4, y: 8, kind: 'transmuter', name: 'Transmuter' },
  { x: 8, y: 8, kind: 'mirrorforge', name: 'Mirrorforge' },
  // market (upper-right)
  { x: 21, y: 5, kind: 'merchant', name: 'Merchant' },
  { x: 25, y: 5, kind: 'gambler', name: 'Gambler' },
  { x: 23, y: 8, kind: 'ramen', name: 'Ramen House' },
  // arcane grove (lower-left)
  { x: 4, y: 15, kind: 'mystic', name: 'Mystic' },
  { x: 8, y: 15, kind: 'covenants', name: 'Covenant Altar' },
  { x: 4, y: 18, kind: 'weave', name: 'Ascendant Weave' },
  { x: 8, y: 18, kind: 'pantheon', name: 'Pantheon' },
  // civic green (lower-right)
  { x: 21, y: 15, kind: 'healer', name: 'Healer' },
  { x: 25, y: 15, kind: 'trainer', name: 'Trainer' },
  { x: 23, y: 14, kind: 'bounty', name: 'Bounty Board' },
  { x: 21, y: 18, kind: 'deeds', name: 'Hall of Deeds' },
  { x: 25, y: 18, kind: 'cycles', name: 'Cycles' },
  // flanking the plaza / arrival
  { x: 12, y: 13, kind: 'stash', name: 'Vault' },
  { x: 18, y: 13, kind: 'sellsword', name: 'Sellsword' },
];

// Organic scenery. `c` is a decor FAMILY char (see TOWN_DECOR_FAMILIES); buildTown
// resolves each to a concrete atlas piece deterministically, so the town looks
// varied but identical every visit. Solid families block their tile.
export const TOWN_DECOR = [
  { x: 1, y: 20, c: 'T' }, { x: 2, y: 1, c: 'T' }, { x: 3, y: 20, c: 'T' }, { x: 4, y: 1, c: 'T' }, { x: 5, y: 1, c: 't' },
  { x: 6, y: 1, c: 'T' }, { x: 6, y: 20, c: 'b' }, { x: 7, y: 1, c: 't' }, { x: 8, y: 1, c: 'b' }, { x: 8, y: 20, c: 't' },
  { x: 9, y: 1, c: 't' }, { x: 9, y: 20, c: 'T' }, { x: 10, y: 1, c: 'T' }, { x: 11, y: 1, c: 't' }, { x: 19, y: 1, c: 't' },
  { x: 19, y: 20, c: 'b' }, { x: 20, y: 1, c: 'T' }, { x: 21, y: 20, c: 'T' }, { x: 22, y: 1, c: 'b' }, { x: 23, y: 1, c: 'b' },
  { x: 24, y: 1, c: 'b' }, { x: 24, y: 20, c: 't' }, { x: 25, y: 1, c: 't' }, { x: 26, y: 1, c: 'b' }, { x: 27, y: 1, c: 't' },
  { x: 27, y: 20, c: 'T' }, { x: 28, y: 1, c: 'T' }, { x: 28, y: 20, c: 't' }, { x: 1, y: 3, c: 't' }, { x: 28, y: 5, c: 'T' },
  { x: 28, y: 6, c: 't' }, { x: 1, y: 7, c: 'b' }, { x: 28, y: 7, c: 'T' }, { x: 1, y: 8, c: 'b' }, { x: 28, y: 8, c: 't' },
  { x: 1, y: 10, c: 'T' }, { x: 28, y: 11, c: 'T' }, { x: 1, y: 14, c: 'b' }, { x: 28, y: 15, c: 'b' }, { x: 28, y: 16, c: 't' },
  { x: 13, y: 2, c: 'z' }, { x: 17, y: 2, c: 'z' }, { x: 12, y: 3, c: 'b' }, { x: 18, y: 3, c: 'b' }, { x: 13, y: 4, c: 'z' },
  { x: 16, y: 4, c: 'z' }, { x: 13, y: 8, c: 'z' }, { x: 16, y: 8, c: 'z' }, { x: 13, y: 14, c: 'z' }, { x: 16, y: 14, c: 'z' },
  { x: 13, y: 17, c: 'z' }, { x: 16, y: 17, c: 'z' }, { x: 3, y: 4, c: 'z' }, { x: 6, y: 4, c: 'o' }, { x: 7, y: 4, c: 'o' },
  { x: 3, y: 7, c: 'd' }, { x: 9, y: 7, c: 'z' }, { x: 6, y: 9, c: 'o' }, { x: 2, y: 6, c: 'b' }, { x: 10, y: 5, c: 'b' },
  { x: 20, y: 4, c: 'o' }, { x: 26, y: 4, c: 'o' }, { x: 22, y: 4, c: 'p' }, { x: 24, y: 4, c: 'p' }, { x: 20, y: 8, c: 'o' },
  { x: 26, y: 8, c: 'r' }, { x: 22, y: 9, c: 'r' }, { x: 24, y: 9, c: 'p' }, { x: 27, y: 6, c: 'b' }, { x: 2, y: 14, c: 'T' },
  { x: 10, y: 14, c: 't' }, { x: 2, y: 17, c: 'T' }, { x: 10, y: 17, c: 'T' }, { x: 6, y: 16, c: 'b' }, { x: 3, y: 16, c: 'f' },
  { x: 9, y: 16, c: 'f' }, { x: 6, y: 14, c: 'b' }, { x: 2, y: 19, c: 'b' }, { x: 10, y: 19, c: 'b' }, { x: 5, y: 19, c: 'f' },
  { x: 7, y: 13, c: 'f' }, { x: 19, y: 14, c: 'T' }, { x: 27, y: 14, c: 'T' }, { x: 19, y: 17, c: 'T' }, { x: 27, y: 17, c: 'T' },
  { x: 23, y: 16, c: 'f' }, { x: 20, y: 16, c: 'p' }, { x: 26, y: 16, c: 'p' }, { x: 23, y: 17, c: 'f' }, { x: 19, y: 19, c: 'b' },
  { x: 27, y: 19, c: 'b' }, { x: 22, y: 19, c: 'f' }, { x: 24, y: 13, c: 'f' }, { x: 24, y: 3, c: 'f' }, { x: 9, y: 4, c: 'f' },
  { x: 17, y: 5, c: 'f' }, { x: 10, y: 7, c: 'f' }, { x: 18, y: 8, c: 'f' }, { x: 3, y: 9, c: 'f' }, { x: 26, y: 9, c: 'f' },
  { x: 4, y: 12, c: 'f' }, { x: 27, y: 12, c: 'f' }, { x: 20, y: 14, c: 'f' }, { x: 13, y: 16, c: 'f' }, { x: 6, y: 18, c: 'f' },
];

// Decor family char → { tag (decor-atlas family), solid (blocks its tile) }.
// buildTown resolves each placement to a concrete DECOR_INDEX piece of that tag.
export const TOWN_DECOR_FAMILIES = {
  T: { tag: 'tree', solid: true },        // leafy shade tree (walk behind the canopy)
  t: { tag: 'tree_pine', solid: true },   // conifer
  b: { tag: 'bush', solid: true },        // hedge-like bush
  o: { tag: 'barrel', solid: true },      // market/storage barrel
  z: { tag: 'brazier', solid: true },     // standing brazier (town lamp)
  f: { tag: 'plant', solid: false },      // flowers / grass tufts (walkable)
  p: { tag: 'potted', solid: false },     // potted plant (walkable)
  r: { tag: 'rug', solid: false },        // market mat / rug (walkable)
  d: { tag: 'debris', solid: false },     // worn ground clutter (walkable)
};
