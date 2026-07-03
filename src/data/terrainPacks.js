// Terrain pack registry — the seam for swapping/adding autotiled ground art.
//
// A "pack" is a set of terrain roles (grass, rock, water, …) painted through
// the corner-Wang autotiler. The game ships one pack today: the bundled LPC
// Terrains atlas, wired directly in legacy/game.js as LPC_TABLE. To add another
// (e.g. a purchased Mana Seed set), convert its autotile sheet with
// systems/terrainAtlas.js, append the tiles to the atlas, register the pack
// here, and opt a biome in via BIOME_PACK_OVERRIDES. See docs/terrain-packs.md
// for the full recipe, the biome→pack map, and licensing.

export const TERRAIN_PACKS = {
  lpc: {
    id: 'lpc',
    label: '[LPC] Terrains',
    tile: 32,
    cols: 32,
    license: 'CC-BY-SA 4.0',
    credit: 'bluecarrot16 & LPC contributors',
  },
  // Target shape for an imported pack (art embedded on purchase):
  // 'manaseed-forest': {
  //   id: 'manaseed-forest', label: 'Mana Seed — Seasonal Forest',
  //   tile: 32, cols: 32,
  //   license: 'Mana Seed User License (single product)',
  //   credit: 'Seliel the Shaper',
  // },
};

// Per-biome pack selection. EMPTY BY DEFAULT ⇒ every biome renders through the
// bundled LPC pack, so the world looks byte-identical to today. Point a biome
// at another pack once its art is embedded, e.g.:
//   'the Cherry Blossom Grove': 'manaseed-forest'
export const BIOME_PACK_OVERRIDES = {};

// Which pack paints a given biome. Falls back to LPC for unmapped biomes and
// for any override naming a pack that isn't registered (so a typo degrades to
// the shipping look rather than a blank floor).
export function packForBiome(biomeName) {
  const id = BIOME_PACK_OVERRIDES[biomeName];
  return (id && TERRAIN_PACKS[id]) || TERRAIN_PACKS.lpc;
}

// Every pack that can actually paint the world right now: LPC always (it is the
// base for unmapped biomes) plus any registered pack a biome opts into. Drives
// the in-game terrain credits so attribution stays truthful automatically as
// packs are added.
export function terrainPacksInUse() {
  const ids = new Set(['lpc']);
  for (const id of Object.values(BIOME_PACK_OVERRIDES)) if (TERRAIN_PACKS[id]) ids.add(id);
  return [...ids].map((id) => TERRAIN_PACKS[id]);
}
