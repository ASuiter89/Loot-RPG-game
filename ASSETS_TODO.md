# ASSETS TODO — endgame art to draw

The endgame update ships with **placeholder art**: every new sprite key below is
currently aliased (via `_egPlaceholderSprite()` in `src/legacy/game.js`) to a
themed *existing* atlas tile so nothing renders blank. Replace each with real
pixel art in the icon atlas (`SPRITE_IDX` + the sprite sheet), then the placeholder
bridge auto-falls-through to the real tile (it only fires when a key is missing).

**House rule:** all on-screen art must be real pixel art — never an emoji as the
thing itself. These are all shippable pixel-art tiles.

## How the placeholder currently resolves
`src/legacy/game.js → _egPlaceholderSprite(name)` maps by prefix:
| prefix | stand-in tile |
|---|---|
| `cov_*` | `ic_cursed` |
| `weave*`, `glyph*` | `mat_glimmer` |
| `mf_*`, `mat_aether` | `mat_chaos` |
| `pin_*` | `feat_gate_red` |
| `cycle*` | `feat_gate_red` |
| `deed*` | `q_relic` |

Also: town-hub tile icons for the six services fall back in `townWalkIcon()`
(same file) to `ic_cursed` / `mat_glimmer` / `mat_chaos` / `feat_gate_red` /
`q_relic`. A proper **town walk-sprite sheet** per service (like other NPCs in
`TOWN_NPC_ART`) would replace those.

## Keys to draw

### Dread Covenants (altar + 15 affliction sigils)
`cov_altar` (town/panel header), and one sigil each:
`cov_frenzy`, `cov_horde`, `cov_teeming`, `cov_legion`, `cov_warband`,
`cov_bloodlust`, `cov_relentless`, `cov_apex`, `cov_annihilation`, `cov_famine`,
`cov_scarcity`, `cov_carapace`, `cov_juggernaut`, `cov_haste`, `cov_swelling`.

### Ascendant Weave
`weave_star` (header). Glyph tiles by tier: `glyph`, plus a distinct tile per
tier (the roll sets `glyph.tier`; a `glyph_<tier>` set would let each rarity read
differently). Optional: per-constellation and per-keystone node icons.

### Mirrorforge
`mf_anvil` (header), `mat_aether` (the new deep material — also wants a wallet
chip icon and a floor pickup sprite), plus optional markers for a Radiant item
(`radiant star`), a Mirrored/perfected frame, and a corruption glyph.

### Pantheon of the Deep (6 gods × base+uber, shards, altar)
`pin_altar`, `pin_shard`, `pin_locked`, and boss portraits:
`pin_thallor`(+`_uber`), `pin_nyxara`(+`_uber`), `pin_vorgrim`(+`_uber`),
`pin_sylvaine`(+`_uber`), `pin_kaethon`(+`_uber`), `pin_umbriel`(+`_uber`).
Also: item icons for the 8 Mythic uniques in `src/data/pinnacleUniques.js` (they
currently use their base gear icon via `iconForBase`, which is fine, but a bespoke
Mythic tint/frame would sell them). Shard currency icons per god type.

### Cycles
`cycle_banner` (header + season banner). Optional per-cycle emblem + a
milestone-complete tick + a Legacy-realm marker.

### Hall of Deeds
`deed_trophy` (header), plus deed tile icons (one per deed in `src/data/deeds.js`,
keys `deed_col_*`, `deed_bes_*`, `deed_conq_*`, `deed_dep_*`, `deed_end_*`,
`deed_bnt_*`, `deed_brd_*`, `deed_set_*`, `deed_mir_*`), reward **frames**
(`deed_frame_iron|bronze|silver|gold|radiant`) and **badges**
(`deed_badge_firstdeed|hunter|hoarder|champion|eternal`). These render around the
hero portrait / on leaderboard rows once real.

## Non-art follow-ups (small, optional)
- `addStashTab()` does not exist yet, so the Renown "stash tab" reward is a
  guarded no-op (titles/frames/badges work). Add it to make that reward live.
- Cycles enrollment tags the *current* hero; a true fresh-start character +
  Legacy-realm fork is a larger persistence feature left for later.
- Malaise ramps enemy *damage* over floor-time (in `takePlayerDamage`); it does
  not re-scale already-spawned enemy HP.
