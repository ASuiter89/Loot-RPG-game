# Terrain packs — evaluating & swapping the ground art

The world's ground (floors, walls, water, lava) is painted by a **2-corner Wang
autotiler**: for every tile the renderer samples the four surrounding cells'
membership in a terrain *role* (`Grass`, `Rock_Gray`, `Water`, …) and picks one
of 16 blob tiles by a 4-bit corner mask. Today all roles come from one bundled
atlas — the **[LPC] Terrains** set (bluecarrot16 & LPC contributors, CC-BY-SA
4.0) — embedded as base64 in `src/legacy/game.js` (`lpcSheet` + `LPC_TABLE`).

This doc is the recipe for replacing/extending that art with a better pack. The
conversion math and the pack registry are already built and unit-tested:

- `src/systems/terrainAtlas.js` — pure autotile + converter functions
  (`cornerMask`, `resolveTileId`, `blobTemplateToRole`, `packRoleIntoAtlas`, …).
  A round-trip test rebuilds the real LPC `Grass` role id-for-id, proving the
  importer and the shipping renderer agree on identical geometry.
- `src/data/terrainPacks.js` — the pack registry + per-biome selection
  (`TERRAIN_PACKS`, `BIOME_PACK_OVERRIDES`, `packForBiome`,
  `terrainPacksInUse`). **Empty overrides by default ⇒ the world is unchanged.**
  The in-game terrain credits are generated from this registry, so attribution
  stays truthful automatically as packs are added.

## License: the AI clause is the first filter

This project ships **AI-generated code**. That makes an asset license's AI
wording the *first* thing to check — and there are two very different kinds:

| Clause type | Example wording | Us? |
|---|---|---|
| **Type 1 — don't train AI *on* the art** | "You can not use this asset as database for AI training" | ✅ **Fine** — we don't train on it |
| **Type 2 — no AI *anywhere in the project*** | "I do not consent for my art to be used in a project alongside AI-generated imagery, writing, **code**, or anything else" | ❌ **Disqualifies us** |

- **Mana Seed** (Seliel the Shaper) is **Type 2 → ruled out.** Beautiful, but its
  license forbids use in any project containing AI-generated code.
- **Epic RPG World**, **CraftPix**, and all **Creative Commons** (CC0/CC-BY/
  CC-BY-SA) art are Type 1 or silent → **safe.** CC licenses never carry an AI
  restriction, so the bundled LPC set and any CC art are categorically safe.

Individual premium pixel artists on itch increasingly add Type-2 clauses — always
read the license before buying, and prefer studios/marketplaces/CC for safety.

## Recommended: Epic RPG World Complete Collection (RafaelMatos)

Best fit for "really high quality, any 2D style, cover every biome, license OK
with AI code, happy to overhaul the whole look":

- **Native 32×32** — matches our grid exactly, no upscaling.
- **Autotiled terrain**, broad biomes incl. **Volcano** (the lava the overworld
  packs usually miss), Desert, Highlands, Crypt, Sewers, Ancient Ruins, Depths of
  the Mountain, Sea, Cemetery, Village, Grassland.
- **Cohesive series** — matching character / enemy / boss / GUI / FX packs, so a
  full visual overhaul (not just ground) lands in one consistent style.
- **License:** commercial use OK; only bars using the art *as an AI-training
  dataset* (Type 1 — fine for us) and reselling the raw files (irrelevant to a
  private game). ~$119.90 for the environment collection; character/enemy/UI
  packs sold alongside.

### Biome → environment map

| Biome (`LPC_BIOME` key) | Epic RPG World source |
|---|---|
| the Sunlit Forest / Wildflower Meadow / Cherry Blossom Grove / Autumn Woods / Lavender Fields | Grassland 2.0 (+ palette recolors) |
| the Pine Highlands / Emerald Jungle | Highlands |
| **the Frozen Halls / Winter Frostwood** | Highlands (snow theme) — **verify/fill snow; else keep LPC snow** |
| the Golden Savanna / Harvest Vineyard | Desert / Grassland / Village |
| the Sunken Tombs | Ancient Ruins / Desert |
| the Stone Crypt / Void Sanctum | Crypt |
| the Mossy Caverns / Mushroom Hollow / Crystal Cavern | Depths of the Mountain / Sewers |
| **the Lava Depths / Obsidian Wastes** | **Volcano** |
| the Coral Lagoon / Sunlit Shore | Sea Adventures |

The only likely gap is dedicated **snow/ice**; fill with a recolor or keep the
bundled LPC snow roles for those two biomes.

### Alternatives (all AI-code-safe)

- **Oryx Ultimate Fantasy** ($5, 48×48) — a complete cohesive retro collection
  (heroes, monsters, dungeons, items, UI); royalty-free commercial. Cheapest full
  overhaul; lower-res, 48px needs a rescale. Confirm its license's AI wording.
- **CraftPix** (per-pack ~$5–8 or all-access membership) — widest 2D coverage in
  pixel **and** hand-drawn/vector styles. AI clause is Type 1 (no training on the
  art). Style-flexible; quality is good, not premium-boutique.
- **CC floor (zero license risk, forever):** stay in the LPC/OpenGameArt/Kenney
  (CC0) ecosystem. No payment, no AI clause ever; quality caps at "good."

## What a pack must provide (the spec)

| Requirement | Value |
|---|---|
| Tile size | 32×32 px (16/48 px art is fine — rescale nearest-neighbour) |
| Autotiling | corner/Wang blob (the 15 transition tiles + interior fills) per role |
| Roles to cover | grass, dirt, rock/stone, sand, soil, gravel, mud, snow + ice, water (+ shallows/deep/tint), **lava** |
| Biomes to cover | the 21 in `LPC_BIOME` (see map above) |
| License | Type-1 or CC (see AI section); usable in one commercial game; private repo moots extractable-asset clauses |

## Importing a pack (the mechanical steps)

1. **Get the art** — download the pack; drop its autotile sheet(s) in
   `scratchpad/` (do not commit raw purchased sheets).
2. **Describe the layout once** — for each role, a `blobTemplateToRole` template
   maps mask `1..15` (+ `fills`) to `[col,row]` cells in the source sheet.
3. **Convert** — feed templates through `blobTemplateToRole` →
   `packRoleIntoAtlas(role, { cols: 32, nextId: <first free atlas cell> })`. This
   returns the game-shaped `{mask:id}` table + fills and the list of pixel copies
   (`blits`) to composite the source tiles into the atlas.
4. **Embed** — append the new tiles to the atlas PNG, re-base64 it into
   `lpcSheet.src`, and merge the converted roles into `LPC_TABLE.table` (and
   `LPC_FILLS`) under new keys, e.g. `Grass_ERW`.
5. **Register + opt in** — add the pack to `TERRAIN_PACKS`, point the biome's
   roles at the new keys in `LPC_BIOME`, and set
   `BIOME_PACK_OVERRIDES['<biome>'] = '<pack id>'` so the credits pick up the new
   attribution.
6. **Verify green** — `npm test`, `npm run build`, `npm run smoke`; boot and eyeball the biome.

Because packs append into the shared atlas and merge into `LPC_TABLE`, no change
to the autotiler/renderer is needed for the first pack — the swap is data + one
registry line. A pack with its own separate atlas image would additionally route
through `packForBiome` in `drawLPCTerrain` to pick the right sheet.
