# Refactor CHANGELOG — what moved where

A running, newest-first log of the modularization. This tracks **structure**
(code relocation, tooling) — it is distinct from the in-game `CHANGELOG` array in
`index.html` (which is player-facing patch notes). Each entry keeps the build +
test suite + smoke green.

> Legend: 🏗️ tooling · 📦 extraction (code moved out of the monolith) · 🧪 tests ·
> 📄 docs

## Feature — equipment sets get their own size + slots

- 📦 The set **roster** moved out of `src/legacy/game.js` into
  `src/data/itemSets.js` (`ITEM_SETS`, now with a per-set `slots` list), and the
  pure set helpers into `src/systems/itemSets.js` (`setPieceCount`, `setTopTier`,
  `setComplete`, `setStatContribution`, `rollItemSetId`, `setsCoverAllSlots`).
  The monolith imports them back; its inline `ITEM_SETS` and `setMaxTier` are
  gone, `rollItemSet(slot)`/`setComplete`/`setStatBonus` delegate to the
  extracted logic, and `window.setMaxTier` is replaced by `window.setPieceCount`.
- Each set now has a fixed size = its slot count, and sets vary (2 → 6 pieces).
  A piece only rolls for a slot its set covers; completion, the "Worn: n / size"
  tooltip denominator and the top bonus tier all key off the real size. Two new
  sets (Stalker's Shroud, Herald's Fortune) join the roster.
- The set tooltip lists only that set's slots and is ~2× wider (`#hovertip.wide`,
  toggled when the card holds a `.set-tip`, in `src/styles.css`).
- 🧪 `test/systems/itemSets.test.js` (piece counts, completion, stat
  contribution, slot-scoped rolls, coverage) and `test/data/itemSets.test.js`
  (roster validity: real distinct slots, top tier == size, known stat keys, full
  slot coverage).

## Feature — Sellsword multi-floor hire + pricing overhaul

- 📦 Mercenary **content + pricing** moved out of `src/legacy/game.js`:
  `MERC_TYPES` (now with a per-merc `accent`), `MERC_ART`, the new
  `MERC_DURATIONS` (1/10/30-floor contracts) and `MERC_PRICE` tuning live in
  `src/data/mercenaries.js`; the pure cost model (`mercFloorRate`, `mercCost`)
  lives in `src/systems/mercPricing.js`. The monolith imports them back and its
  old `MERC_FLOORS`/`mercCost`/`MERC_TYPES`/`MERC_ART` definitions are gone.
- The Sellsword camp now hires for a chosen contract length (like a Mystic pact),
  the per-floor cost is far higher and scales with the deepest floor reached, and
  longer contracts get a gentle per-floor discount. `renderMercCamp` reuses the
  `.pact-card` component; `hireMerc(id, floors)` takes the duration.
- 🧪 `test/systems/mercPricing.test.js` (depth scaling, gentle bulk discount,
  drastic-increase check) and `test/data/mercenaries.test.js` (data shape).

## Feature — ascendancy skill points (own pool)

- 📦 The skill-point **economy** moved from `src/legacy/game.js` into
  `src/systems/skillMath.js`: `earnedSkillPoints` plus the new `earnedAscPoints`
  and the tuning constants (`SKILL_POINTS_PER_LEVEL`, `SKILL_POINTS_AT_START`,
  `ASCEND_LEVEL`, `ASC_POINT_EVERY`). Pure functions, imported back into the
  monolith. Ascendancy (path) skills now spend a separate `player.ascPoints`
  pool (one every 5 levels from level 20); path skills lost their level gate.
- 🧪 `test/systems/skillMath.test.js` gains coverage for `earnedSkillPoints` and
  the `earnedAscPoints` cadence.

## Fix — dual-host deploy (Netlify + GitHub Pages)

- 🏗️ `index.html` now references `./src/main.js` and `./src/styles.css`
  **relatively** (were absolute `/src/…`). Absolute paths resolve to the domain
  root and 404 on a GitHub Pages **project subpath** (`/Loot-RPG-game/`), which
  served the raw source unstyled. Relative paths work at a root domain (Netlify's
  built `dist/`) **and** the subpath (Pages' raw source).
- 🏗️ Added a root `.nojekyll` so GitHub Pages serves `src/` verbatim.
- 🧪 Baseline gates now **require** relative asset paths (reject `/src/…`); added
  `npm run smoke:pages` (raw source over HTTP, the Pages path) alongside
  `npm run smoke` (built `dist/`). Both green.

## Phase 3b — externalize the CSS

- 📦 The 4.3k-line inline `<style>` moved to `src/styles.css`, referenced by a
  render-blocking `<link rel="stylesheet">` in `<head>`. index.html: 770 lines
  (markup + head only). Vite emits a separate hashed `.css` asset in the build.
- 🏗️ `tools/styles-lint.js` now lints `src/styles.css` (whole file = CSS; `:root`
  = token defs).
- 🧪 Smoke gains a `--gold` token check that proves the externalized CSS is
  applied **before** game.js's `getComputedStyle`-based `PALETTE` snapshot runs
  (the one real timing risk). Verified applied in both `vite build` and the dev
  server (browser-checked `--gold` = `#e8c267`).

## Phase 4 — incremental pure-module extraction (with tests)

Each increment: move a self-contained pure cluster verbatim into a `src/` module,
replace its definition in `game.js` with an `import`, add unit tests, and verify
`vite build` + smoke (behavior identical) + suite green.

**Increment 5 — terrain-pack pipeline (swap the ground art)**
- 📦 `src/systems/terrainAtlas.js` — pure autotile + converter core for importing
  a new terrain pack: `cornerMask`, `terrainHash`, `resolveTileId`, atlas
  id math, `blobTemplateToRole` (a pack's Wang layout → the game's `{mask:id}`
  table), `packRoleIntoAtlas` (append tiles + record pixel copies). No DOM/canvas.
- 📦 `src/data/terrainPacks.js` — pack registry + per-biome selection
  (`TERRAIN_PACKS`, `BIOME_PACK_OVERRIDES`, `packForBiome`, `terrainPacksInUse`).
  Overrides empty by default ⇒ world renders byte-identically. game.js now
  generates the terrain **credits** from this registry (import `terrainPacksInUse`),
  so attribution stays truthful as packs are added.
- 🧪 `test/systems/terrainAtlas.test.js` (18) incl. a fidelity round-trip that
  rebuilds the real LPC `Grass` role id-for-id; `test/data/terrainPacks.test.js`
  (7). 100 % lines/funcs/statements over the new modules.
- 📄 `docs/terrain-packs.md` — evaluation + import recipe: the AI-license filter
  (Type-1 "no training on the art" = OK vs Type-2 "no AI in the project" = out),
  the recommended pack (Epic RPG World) + biome map, and the mechanical swap.
- 🏗️ `src/render/procTerrain.js` + a `?terrain=proc` preview path in game.js — a
  procedural terrain-pack renderer that paints the dungeon ground (floor/wall/
  water/lava) via 2-corner-Wang blending, to preview a full terrain swap in the
  real engine. Off by default (flag-gated); `scripts/terrain-preview-shot.mjs`
  boots it in Chromium and screenshots real levels. `src/render/**` excluded from
  coverage (canvas draw layer, characterized by smoke).
- ✅ 151 tests, coverage 100/100/100/99, build + smoke green (208/208 handlers,
  full gameState/gameGuide contract); normal play unaffected (flag off).

**Increment 1 — pure formula/utility leaves**
- 📦 `src/utils/color.js` ← `shadeColor`, `hexA`, `_parseRGBA` (pure colour math,
  zero deps).
- 📦 `src/systems/skillMath.js` ← `milestonePower`, `rankScale`, `skillManaCost`
  (+ their private `MANA_PER_RANK` / `SKILL_MP_MULT` consts) — pure skill-rank math.
- 🧪 Full unit tests for both (`test/utils/color.test.js`,
  `test/systems/skillMath.test.js`); 100 % coverage over all extracted modules.
- ✅ game.js still strict-ESM-parses; build + smoke green; 93 tests pass. The
  `window` bridge still resolves (imported names stay in module scope).

**Increment 2 — a core formula + the first data module**
- 📦 `src/systems/ratings.js` ← `rated` (the core rating→chance formula) +
  `ratePct` + `SKILL_RATING`. Pure.
- 📦 `src/data/changelog.js` ← the 330-entry `CHANGELOG` array (player-facing
  patch notes) — the first `data/` extraction, per the data-driven-design rule.
  game.js: 25,488 → 25,097 lines.
- 🧪 `test/systems/ratings.test.js` (formula + monotonicity + asymptote) and
  `test/data/changelog.test.js` (entry-shape validity, newest-first ordering, and
  the "never reference another game" changelog rule as an enforced data check).
- ✅ build + smoke green (behavior identical), 108 tests, 100 % coverage over all
  extracted modules.

**Increment 3 — the persistence repository seam (Supabase isolation)**
- 📦 `src/persistence/leaderboardRepo.js` — the first repository. Pure request
  builders (`buildSubmitRequest`, `buildFetchUrl`, `buildRangeHeaders`,
  `restHeaders`) + `createLeaderboardRepo({ fetchImpl, url, key })` with an
  **injected `fetch`**. game.js's `lbSubmit`/`lbFetch` now route their Supabase
  REST through it (identical requests: same endpoints, headers, `on_conflict`,
  Range paging, abort-timeout, error propagation) — the inline `fetch` calls are
  gone from the leaderboard path.
- 🧪 `test/persistence/leaderboardRepo.test.js` — 11 tests against a **mock
  `fetch`** (never hits the backend): request shape, Standard/Hardcore filtering,
  multi-page concatenation, non-OK throw, submit error-swallowing, and
  timeout arm/clear via injected timer/AbortController.
- ✅ Establishes the D8 pattern for the remaining Supabase surface (saves, auth,
  settings). game.js parses, build + smoke green, 121 tests, 100 % coverage.

## Phase 3 — inline `<script>` → ES module + `window` bridge

- 📦 **The 24.2k-line inline `<script>` moved verbatim** into
  `src/legacy/game.js` (an ES module); `index.html` now loads it via
  `src/main.js` (`<script type="module">`). `index.html` shrank 29,314 → 5,083
  lines (6.9 MB → 664 KB); the `<style>` block stays inline for now.
- 📦 **Transitional `window` bridge** appended to `game.js`: all **1,188**
  top-level functions are re-exposed as `window` properties (they were global in
  the old classic script), and **36** handler-referenced state globals are
  exposed as **live getters/setters backed by the module bindings** — so a
  handler that reads `player.gold` sees the current value and one that writes
  `selectedSkillId=null` updates the real variable. Verified the script parses as
  a strict ES module (no duplicate decls / octals / sloppy-only constructs).
- 🧪 **Smoke upgraded** to serve over HTTP (a Vite module bundle can't load over
  `file://`) and to verify the bridge: all **208** inline-handler target
  functions present on `window`, live state accessors read/write through, and a
  real inline `onclick="openAccount()"` click opens `#account-overlay`.
  `test/smoke/handler-globals.json` pins the handler set.
- 🧪 Baseline gates updated for the new structure: the syntax gate now
  strict-ESM-parses every `src/**` + `test/**` module; the structure gate finds
  the Supabase config / console API / CHANGELOG / bridge in `src/legacy/game.js`
  and the module entry in `index.html`.
- ✅ Verified: `vite build` ok, `vite` dev server serves the module, smoke passes
  on the built `dist`, 70 unit/characterization tests green, coverage 100 % over
  extracted `src/**`, styles-lint clean. **No game behavior changed** — same
  33-key `gameState()` / 18-topic `gameGuide()` contract.

## Phase 0–2 — Discovery, tooling & green baseline

- 📄 **Discovery inventory** recorded in [`DISCOVERY.md`](./DISCOVERY.md):
  rendering = Canvas 2D only (no WebGL); **zero runtime dependencies** (Supabase
  via raw `fetch`, fonts/art embedded base64); 1,188 functions + 552 module-scope
  vars in one scope; 253 inline handlers → 171 global functions; 164
  `Math.random` / 99 `localStorage` / 49 clock call sites; full subsystem +
  persistence map.
- 📄 **Architecture & migration plan** recorded in [`DECISIONS.md`](./DECISIONS.md):
  the single-file→modular pivot (static bundle preserved), the `src/` taxonomy,
  dependency rules, the strangler + `window`-bridge migration, injected RNG/clock,
  and the persistence repository seam. Suspicious code logged in
  [`BUGS.md`](./BUGS.md) (not fixed — pure refactor).
- 🏗️ **Vite** added (`vite.config.js`, `base: './'`) — `npm run build` emits a
  static `dist/` bundle; verified byte-identical to the source `index.html` at
  baseline. `dist/` + `coverage/` git-ignored.
- 🏗️ **Vitest + jsdom + coverage-v8** configured (thresholds 90/90/85/90 over
  extracted `src/**`, legacy excluded). **Playwright** smoke wired against the
  pre-installed Chromium.
- 🧪 **Baseline characterization (all green):**
  - `test/baseline/index-syntax.test.js` — every inline script parses (`vm`).
  - `test/baseline/index-structure.test.js` — ~30 critical DOM ids, Supabase
    config, `window.gameState/gameGuide` exposure, inline-handler surface.
  - `test/smoke/smoke.mjs` — boots the real game in Chromium; pins the full
    `gameState()` 33-key + `gameGuide()` 18-topic contract; passes on source
    **and** built `dist`.
- 📦 **First pure module extracted:** `src/utils/rng.js` — injectable/seedable RNG
  (`mulberry32`, `sysRandom`, `rndInt`, `rndFloat`, `pick`, `chance`, `shuffle`)
  with full unit tests (`test/utils/rng.test.js`). This is the seam that makes
  loot/combat/mapgen deterministically testable without changing shipped behavior.

_Baseline gate status: `npm test` 60 passing · `npm run build` ok · `npm run
smoke` ok (source + dist)._
