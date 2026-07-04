// Terrain atlas / autotile math — the pure core of the "terrain pack" pipeline.
//
// The world renderer paints ground through a 2-corner Wang autotiler: for every
// tile it samples the four surrounding cells' membership in a terrain role and
// looks up one of 16 blob tiles by a 4-bit corner mask. Today that lives inline
// in legacy/game.js (lpcLayer/lpcVariant/lpcTile) bound to the bundled LPC
// Terrains atlas. This module re-expresses the same math as injected, testable
// functions and adds the converter that turns an imported pack's autotile sheet
// into the game's {role:{mask:id}} table + atlas placement.
//
// Keeping it here (systems/, no DOM/canvas) means the mapping a purchased pack
// goes through is unit-tested, so dropping new art in can't silently mis-tile.

// Corner bit layout — MUST match lpcLayer in legacy/game.js exactly:
//   NW=8, NE=4, SW=2, SE=1  (a set bit = that corner is inside the role).
export const CORNER_BITS = Object.freeze({ NW: 8, NE: 4, SW: 2, SE: 1 });

// Build the 4-bit mask from the four corner memberships around a tile.
export function cornerMask(nw, ne, sw, se) {
  return (nw ? CORNER_BITS.NW : 0)
       | (ne ? CORNER_BITS.NE : 0)
       | (sw ? CORNER_BITS.SW : 0)
       | (se ? CORNER_BITS.SE : 0);
}

// Deterministic per-cell hash for picking a fill variant — mirrors lpcHash so a
// converted pack scatters its interior tiles identically to the bundled one.
export function terrainHash(x, y) {
  let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// Resolve which atlas tile id paints a cell, given a role's mask table and its
// optional interior fill variants. Mirrors lpcLayer + lpcVariant:
//   mask 0  -> null (nothing to paint; the base fill already covers it)
//   mask 15 -> a fill variant (scattered by terrainHash) or table[15]
//   else    -> table[mask] (may be null if the pack lacks that transition)
export function resolveTileId(table, fills, mask, x, y) {
  if (!mask) return null;
  if (mask === 15) {
    if (fills && fills.length >= 2) return fills[terrainHash(x, y) % fills.length];
    const t = table && table[15];
    return t == null ? null : t;
  }
  const id = table ? table[mask] : null;
  return id == null ? null : id;
}

// Which of the 15 Wang transition masks (1..15) a blob table is missing. A role
// used as a biome/indoor floor, accent or wall MUST ship all 15: the renderer
// picks one tile per mask, and a gap makes it fall back to the flat interior fill
// — so an absent transition reads as a hard-edged patch of a NEIGHBOURING layer
// (a stray primary-floor tile under an accent), not a smooth curved edge. This is
// the check that keeps that class of bug out (e.g. Mudstone_Gray once lacked mask 9).
export function blobMissingMasks(table) {
  const missing = [];
  for (let m = 1; m <= 15; m++) if (!table || table[m] == null) missing.push(m);
  return missing;
}

// ── Atlas index math ── an atlas is a fixed-width grid of square cells; a tile
// id is just its row-major position (id = row*cols + col). These convert between
// the two so the converter can place tiles and the renderer can slice them.
export function atlasId(col, row, cols) { return row * cols + col; }
export function atlasColRow(id, cols) { return { col: id % cols, row: (id / cols) | 0 }; }

// ── Converter ── turn an imported pack's autotile *template* into a game role.
//
// A template describes, for a single terrain role, where each of the 15 Wang
// tiles sits in the source sheet, as { mask: [col,row] } for masks 1..15, plus
// optional `fills: [[col,row], …]` giving extra seamless interior variants.
// (Most packs — Mana Seed, LPC, RPG-Maker A2 — ship a fixed such arrangement;
// the geometry per format is captured once in docs/terrain-packs.md.)
//
// Returns the game-shaped role: { table:{mask:id}, fills:[id,…] } with ids in
// the source sheet's own coordinate space. Use packRoleIntoAtlas to relocate
// those ids into the shared game atlas.
export function blobTemplateToRole(template, sheetCols) {
  if (!template || typeof template !== 'object') throw new Error('template required');
  if (!(sheetCols > 0)) throw new Error('sheetCols must be positive');
  const table = {};
  for (let mask = 1; mask <= 15; mask++) {
    const cell = template[mask];
    if (!cell) continue; // pack omits this transition — renderer falls back
    table[mask] = atlasId(cell[0], cell[1], sheetCols);
  }
  const fills = (template.fills || []).map(([c, r]) => atlasId(c, r, sheetCols));
  // The interior tile doubles as the first fill variant when none are listed.
  if (!fills.length && table[15] != null) fills.push(table[15]);
  return { table, fills };
}

// Relocate a source role's tiles into the destination game atlas, appending
// them after everything already placed. Returns the rewritten role plus the
// list of pixel copies (source id -> destination id) the image step performs.
//
//   atlasState = { cols, nextId }  (nextId is mutated forward as tiles append)
export function packRoleIntoAtlas(role, atlasState) {
  const blits = [];
  const remap = new Map();
  const relocate = (srcId) => {
    if (srcId == null) return null;
    if (!remap.has(srcId)) {
      const dstId = atlasState.nextId++;
      remap.set(srcId, dstId);
      blits.push({ src: srcId, dst: dstId });
    }
    return remap.get(srcId);
  };
  const table = {};
  for (let mask = 1; mask <= 15; mask++) {
    if (role.table[mask] != null) table[mask] = relocate(role.table[mask]);
  }
  const fills = (role.fills || []).map(relocate);
  return { table, fills, blits };
}
