# ASSETS TODO — endgame art

**Status: the endgame art set is complete and shipped.** All 72 icons live as
real pixel art in `src/assets/endgameArt.js` (`ENDGAME_ART`), rendered through
`egArtSpan()` → `dlIconAt()` in `src/legacy/game.js`, and the six town-service
keepers are real 4-frame walk strips in `TOWN_NPC_ART` (same 192×48 format as the
built-in townsfolk). Nothing below renders a placeholder anymore.

**House rule:** all on-screen art is real pixel art — never an emoji as the thing
itself. Everything here is a shippable pixel-art tile.

## What shipped (all real art)

- **Dread Covenants (16):** `cov_altar` header + 15 affliction sigils
  (`cov_frenzy`, `cov_horde`, `cov_teeming`, `cov_legion`, `cov_warband`,
  `cov_bloodlust`, `cov_relentless`, `cov_apex`, `cov_annihilation`, `cov_famine`,
  `cov_scarcity`, `cov_carapace`, `cov_juggernaut`, `cov_haste`, `cov_swelling`).
- **Ascendant Weave (7):** `weave_star` header + glyph tiles `glyph` and
  `glyph_1`…`glyph_5` (one per tier, so each rarity reads differently).
- **Mirrorforge (5):** `mf_anvil` header, `mat_aether` (deep material — wallet chip
  + floor pickup), and the item markers `mf_radiant`, `mf_mirrored`, `mf_corrupt`.
- **Pantheon of the Deep (21):** `pin_altar`, `pin_locked`, generic `pin_shard`,
  the six gods `pin_thallor`/`pin_nyxara`/`pin_vorgrim`/`pin_sylvaine`/`pin_kaethon`/
  `pin_umbriel` each **plus** its `_uber` ascended variant, and the six per-lineage
  shard icons `pin_shard_tide|void|ember|thorn|storm|hollow` (wired via
  `egShardIcon()`).
- **Cycles (3):** `cycle_banner` header/season banner, `cycle_milestone` tick,
  `cycle_legacy` realm marker.
- **Hall of Deeds (20):** `deed_trophy` header, 9 category tiles (`deed_collection`,
  `deed_bestiary`, `deed_conquest`, `deed_depth`, `deed_endless`, `deed_bounty`,
  `deed_breadth`, `deed_set`, `deed_mastery`), 5 Renown frames
  (`deed_frame_iron|bronze|silver|gold|radiant`) and 5 badges
  (`deed_badge_firstdeed|hunter|hoarder|champion|eternal`).
- **Town-service keepers (6 walk strips):** `covenants` (ritual priest), `weave`
  (astromancer), `mirrorforge` (arcane forgemaster), `pantheon` (deep oracle),
  `cycles` (herald), `deeds` (loremaster curator) — animated in the town hub and
  on the canvas exactly like the built-in NPCs.

## Optional polish (nice-to-have, not blocking)

- **Weave node art:** the constellation/keystone nodes reuse the glyph/tier tiles;
  bespoke per-constellation and per-keystone icons would sell the board further.
- **Mythic unique tint/frame:** the 8 Mythic uniques in `src/data/pinnacleUniques.js`
  reuse their base gear icon via `iconForBase` (acceptable); a distinct Mythic
  tint/frame would set them apart.

## Non-art follow-ups (small)

- `addStashTab()` does not exist yet, so the Renown "stash tab" reward is a guarded
  no-op (titles/frames/badges all work). Add it to make that reward live.
- Cycles enrollment tags the *current* hero; a true fresh-start character +
  Legacy-realm fork is a larger persistence feature left for later.
- Malaise ramps enemy *damage* over floor-time (in `takePlayerDamage`); it does not
  re-scale already-spawned enemy HP.
