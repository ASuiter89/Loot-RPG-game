# Discovery & Inventory Report — Dungeon Loot

_Baseline commit: `bf3e1b4`. Produced before any refactor edits by an exhaustive,
chunked read of `index.html` (8 parallel region passes). This is the factual
map of the codebase as it exists today; the architecture and plan built on it
live in [`DECISIONS.md`](./DECISIONS.md)._

## 1. Shape of the artifact

- **One file**: `index.html` — 29,314 lines, **6.9 MB**.
- **~73.5 % of the bytes are embedded base64** on 39 very long lines: 11 `woff2`
  fonts (lines 58–134) and the sprite/terrain/furniture PNG atlases + hero walk
  sheets + town-NPC art (lines 5474–6498). **Real source is ~1.9 MB across
  ~29,275 lines.**
- Structure: `<head>` 1–8 · inline `<style>` **8–4321** (~4.3k lines) · `<body>`
  markup **4323–5080** · one inline `<script>` **5081–29312** (~24.2k lines).
- **No ES classes at all.** The code is **1,188 top-level `function`
  declarations + 552 module-scope `const`/`let`/`var`** sharing one lexical
  scope. State and behavior are interleaved, not layered.

## 2. Rendering approach

- **Canvas 2D, exclusively.** `canvas.getContext('2d')` (main ctx acquired at
  line 12458); **no WebGL**. A separate 2D context is used for the minimap
  (line 19179) and for a handful of offscreen canvases (sprite-tint caches,
  cursor bake, hero-portrait bake).
- A single `requestAnimationFrame` loop (`gameLoop`, line 29276, kicked off at
  29311) drives everything. Fixed-step world logic is already partly decoupled:
  `stepWorldClock(dt)` runs `worldTick()` on a `WORLD_TICK_MS = 400` accumulator
  (max 2 catch-up ticks), while per-frame movement/render run every frame.
- Pixel art is nearest-neighbour (`imageSmoothingEnabled = false`) for atlas/
  monster/boss/hero/terrain blits; smoothing is deliberately **on** for the 96px
  furniture and indoor-terrain textures.
- **DOM is the other half of rendering.** The HUD, bag, shops, town, modals,
  settings, tooltips, leaderboard, etc. are built by **`innerHTML` string
  templating** into ~120 fixed element ids. There is essentially no
  `createElement` (only the two joystick nodes). 407 inline `data-spr=` spans are
  painted from the atlas at runtime by a "sprite painter" after the atlas image
  loads.

## 3. External dependencies

**None at runtime.** The game is fully self-contained:

- **No CDN scripts, no framework, no libraries, no bundler today.**
- **No Supabase SDK** — the backend is reached with raw `fetch()` to REST/GoTrue
  endpoints (see §7).
- **Fonts** are embedded as base64 `woff2` `@font-face` blocks (11 faces:
  Bangers, Cinzel + 9 player-selectable UI faces).
- **Art** is embedded base64 PNG atlases (bespoke hand-generated sprite,
  monster, boss, hero and town art) indexed by JS lookup tables.
- The only "dependency" is the hardcoded Supabase project URL + publishable anon
  key (lines 27483–27484), which is safe to ship (RLS-gated).

The dev-time tooling this refactor adds (Vite, Vitest, jsdom, Playwright) is
**not shipped** — the deployed artifact stays static files.

## 4. Global state & coupling (the central challenge)

- **552 module-scope variables** in one shared scope. The load-bearing ones:
  `player` (a ~40-field god-object, line 9870), `equipped`/`gearSets`,
  `inventory`, `mapData` (a `[y][x]` numeric grid), `enemies[]`, `minions[]`,
  `particles[]`, `floatingTexts[]`, `projectiles[]`, `statusEffects[]`,
  `combatBuffs{}`, `buffs{}`, `stash`, `dungeonLevel`, `DEV` (tuning knobs), plus
  UI/render flags. Nearly every function reads or mutates these directly.
- **Implicit coupling everywhere:**
  - **Shared globals** are the primary interface between "modules".
  - **Direct DOM reaching** by fixed id (`getElementById(...).innerHTML = …`) is
    a hard markup↔script contract (~120 ids).
  - **Load-order assumptions**: `PALETTE` is snapshotted from CSS `:root` at
    parse time (`getComputedStyle`); image `onload` handlers set ready flags,
    mirror atlases into CSS vars, and call `draw()`; `gameState`/`gameGuide` are
    wrapped in pervasive `typeof x !== 'undefined'` guards precisely because they
    may run before some globals exist.
  - **253 inline `on*=` handlers** (216 `onclick`) resolve against **171 distinct
    global functions** by name. Console helpers are explicitly
    `window.gameState`/`window.gameGuide`/`window.gameBusy`. **This is the single
    biggest migration constraint: converting the inline classic script to an ES
    module breaks all inline handlers unless the referenced functions are
    re-exposed on `window`.**
- **Side effects are inline, not at the edges:** `Math.random()` is called in
  **164 places**, clock (`Date.now`/`new Date`) in **49**, `localStorage` in
  **99**, timers in **23**. There is a global `rnd(lo,hi)` helper but it is not
  injectable. Combat, loot, and map generation are therefore not reproducible /
  not unit-testable as written.

## 5. Subsystem map (where things live)

| Subsystem | Lines (approx) | Notes |
|---|---|---|
| Design-token CSS + 11 fonts + components | 8–4321 | `:root` tokens 136–253; heavy component library; duplicated media-query blocks |
| Body markup (HUD, overlays, modals) | 4323–5080 | ~120 ids; dual mobile/desktop HUD; inline handlers |
| Constants + item/stat data + icon draw | 5081–5620 | `TILE`, `PALETTE`, `SLOTS`, `BASE_STATS`, `WEAPON_SUBTYPES`, `ICON_PATHS`, `SPRITE_IDX` |
| Sprite atlases + drawing primitives | 5620–6770 | 8 image sheets; `drawSpriteC`/`dlIcon`; LPC autotiler; procedural floor/wall/liquid |
| Items / gear / stats / ratings / skills data + engine | 6770–9530 | mostly **pure data + pure derivation**; `rated`, `itemPower`, `resolveActive`, `attrReqValue`, skill trees |
| Floor mods / pacts / conquest / STATE block / audio / gameState API | 9530–12500 | the `player` factory + ~70 globals; full WebAudio SFX+music engine; `window.gameState`/`gameGuide`; `CHANGELOG` array (11900–12233) |
| Map generation / town / shops / services / quests / item generation | 12500–17300 | `generateMap` (13451, ~370 lines), `spawnEnemies` (16874), `generateItem`; DOM-heavy town/shop UI |
| Combat / sim core / particles / terrain draw | 17300–24200 | damage formulas, buffs, enemy AI + pathing (A*/BFS), player movement/collision, particles, cast FX |
| Save/cloud/leaderboard/auth / achievements / input / game loop / bootstrap | 24200–29312 | localStorage saves + migrations; all Supabase `fetch`; keybinds; `gameLoop`; init order |

## 6. Game loop, state, input, audio, assets

- **Loop**: `gameLoop(ts)` (29276) self-schedules rAF; clamps `dt`; runs
  move → combat → cooldowns → autocast → world clock → hazards, each re-checking
  a `rtPaused()` gate (frozen while halted/in-town/dead or a blocking overlay is
  open); `safeStep(name, fn)` wraps each subsystem in try/catch so one bad frame
  can't hang the loop. Persists every ~8 world ticks.
- **State**: scattered mutable module globals (no central store). Autosave is
  debounced (`saveGameSoon`) and also fires on world-tick cadence and on
  tab-hide/pagehide.
- **Input**: one `keydown` router (line 26601) handles text-field guard, keybind
  capture, overlay swallowing, Escape, movement, sprint, and remappable actions;
  `keyup` clears held state; pointer/touch handlers for canvas + joystick + touch
  d-pad; `contextmenu`/`selectstart`/`dragstart`/gesture blockers.
- **Audio**: a full generative engine — `audioInit` builds master →
  compressor → destination with a convolver reverb; `sfx(name)` is a ~40-case
  synth switch; `MUSIC_SECTIONS` (10 style kits) drive a look-ahead scheduler
  (`scheduleMusic` on a 60 ms interval) with boss hijack; town ambience on
  recursive `setTimeout`.
- **Assets**: 8 base64 image sheets + 11 base64 fonts, each with `onload` ready
  flags gating render; sprite index tables (`SPRITE_IDX`, `MONSTER_SPRITE_IDX`,
  `BOSS_SPRITE_IDX`, `LPC_TABLE`) map names → atlas cells.

## 7. Persistence & leaderboard (the layer to isolate)

All backend access is raw `fetch()` against one Supabase project
(`LB_SUPABASE_URL` / `LB_SUPABASE_KEY`, lines 27483–27484), reused for five
concerns. **`fetch` is called un-injected at ~15 sites** with per-call header
builders — the exact thing the repository pattern must centralize.

- **Local saves** (`localStorage`): `saveGame`/`loadGame`/`saveGameSoon`, unbounded
  slots (`slotKey(i)`), a shared account-wide `stash`, a graveyard ledger, a
  hardcore-death ledger, keybinds, and a device-local leaderboard mirror. Save
  JSON shape: `{player, inventory, equipped, gearSets, activeGearSet,
  dungeonLevel, buffs, pact, inTown, dungeonReturn, graveSite, ts}`. `loadGame`
  contains an extensive **migration ladder** (field-presence probes + one real
  `attrSchema` version gate) — prime target to isolate as a pure
  `migrateSave(data)`.
- **Cloud saves** (`/rest/v1/saves`): per-slot upsert/delete/fetch, with
  **sentinel slots** (`-1` stash, `-2` hardcore ledger). Debounced schedulers;
  a keepalive flush on unload. **`cloudReconcile`** implements last-write-wins by
  `ts` with a `cid`-keyed identity and "append newcomers to lowest free slot"
  rule; the merge math is intricate and side-effectful (mutates localStorage,
  fires DELETEs, `location.reload()`s) — should become a pure `reconcile(...)` →
  plan function with a separate applier.
- **Leaderboard** (`/rest/v1/leaderboard`): `lbSubmit` (debounced upsert,
  `on_conflict=name,hardcore`) + `lbFetch(tab)` (paged, `hardcore=eq.` filter for
  the Standard/Hardcore ladders), with a local fallback mirror.
- **Auth** (`/auth/v1/*`, GoTrue REST): `authState {user, accessToken,
  refreshToken, expiresAt}` persisted to localStorage; `ensureToken` refresh;
  `doLogin`/`doSignup`/`doLogout`/`doSyncNow`. State reset is via
  `location.reload()` (8 sites).
- **Settings sync** (`/rest/v1/settings`): last-write-wins account preferences.

## 8. Dead code, duplication & magic numbers (log — do NOT fix inline)

Flagged during discovery; these are **not** to be fixed as part of the pure
refactor (see [`BUGS.md`](./BUGS.md) for anything behavior-affecting). Recorded
so extraction can consolidate deliberately later.

**Duplication (real, consolidate when extracting):**
- The **offense multiplier chain is implemented twice** — `rollPlayerHit`
  (21559) and `applyOffenseMods` (22226) — so any balance change must touch both.
- Triplicated sprite draw/tint/icon stacks for atlas vs monster vs boss (differ
  only by sheet/tile-size/cols) — ~150 lines collapsible to one parameterized
  source descriptor.
- ~15 hand-rolled `.shop-row … .act-btn` templates with no shared `actionRow()`
  helper; 6+ duplicated `do{…}while` spawn-placement loops; multiple near-identical
  reachability flood-fills; four overlapping adjacency scanners with subtly
  different predicates.
- Duplicated portrait/vitals across the parallel **mobile (`#header`) and desktop
  (`#desktop-hud`) HUDs**; duplicated tooltip payload strings; duplicated
  `costLabel`/`costLabelHi`; twice-defined portrait media-query + `moveHintFade`
  keyframes in CSS.

**Dead / legacy:**
- `schedulePortalTick`/`portalTick` no-ops; `runEnemyTurn`'s combat-buff
  aging loop is self-described legacy; `move()` is a compat shim; `ENEMY_BEHAVIOR`
  legacy map superseded by `MONSTERS[type].behavior`; `STAT_NAMES`/`LCK`
  back-compat; `playerCritChance`/`playerDodge` shims.
- **`LEGACY_EMOJI_KEYS` (5487) has duplicate object keys** that silently overwrite
  — most of the table is dead (a latent correctness smell, logged in `BUGS.md`).

**Magic numbers:** damage coefficients, drop rates, curve constants, tile-code
integers (0–14, duplicated across `mapData` writers, the `sym{}` map, and the
`legend` string with no shared enum), z-index literals that ignore the `--z-*`
scale, and atlas-dimension fallbacks that disagree (`2672` vs `256×144`).

## 9. What must stay behaviorally identical

- **`window.gameState(radius)`** — 33 top-level keys (captured in the smoke test).
- **`window.gameGuide(topic)`** — 18 topics + alias map.
- The save-data JSON shape and all `localStorage` keys (existing saves must load).
- The Supabase table shapes and request contracts (existing accounts/leaderboard).
- The 253 inline handler → 171 global-function bindings.
- The Diablo-style color-only loot tiers (no text rarity labels).
- Desktop-only behavior (mouse + keyboard) and the single-file deployability (now
  via a Vite static build).
