# CLAUDE.md — Dungeon Loot

Guidance for Claude Code when working in this repository. **This file is the
source of truth for the architecture; follow it on every edit.** These
instructions override default behavior.

## What this project is

A loot-based pixel RPG that runs entirely in the browser (Canvas 2D + a DOM HUD +
generative WebAudio, **no third-party runtime dependencies**). Backend is Supabase
(async cloud saves + a leaderboard), reached over raw REST and isolated behind a
persistence layer.

The game is a **modular ES-module codebase** built to a **static bundle** with
**Vite**. Source lives in `src/`; `index.html` is just the app shell. `npm run
build` emits `dist/`, which Netlify / GitHub Pages serve as plain static files.
(The project used to be one 30k-line `index.html`; see `docs/DECISIONS.md` for the
pivot and `docs/CHANGELOG.md` for what has moved. A transitional monolith still
lives in `src/legacy/game.js` and shrinks as code is extracted.)

## Hard rules

- **Ship a static bundle — no runtime dependencies.** The build must stay a set of
  static files deployable to Netlify / GitHub Pages with no server. Do not add a
  runtime dependency, framework, or CDN `<script>`. Dev tooling (Vite, Vitest,
  Playwright) is fine — it never ships. Vite `base` is `'./'`; keep asset URLs
  relative so the bundle works at a domain root or a Pages subpath.
- **Desktop-first, with an additive touch layer.** Keyboard + mouse is the
  primary surface and must stay behaviour-identical to how it is today — never
  regress it for the sake of mobile. Touch support is an ADDITIVE layer, gated
  entirely on a JS-toggled `body.touch` class (`setTouchMode()` in
  `src/legacy/game.js`), revealed on the first real touch pointer and retracted on
  a mouse/pen pointer. Rules that keep the two from bleeding into each other:
  - **Never a UA sniff, never a media-query desktop swap.** All mobile styling
    keys off `body.touch` (orientation reflow may use `@media (orientation:…)`
    *scoped under* `body.touch`). A desktop machine never matches `body.touch`, so
    it is byte-identical — the mouse-only smoke run is the guardrail that this holds.
  - **Keyboard stays live in every mode.** The touch buttons reuse the same
    window-bridged handlers (`doDash`, `pickup`, `castSkillById`, …); don't fork
    game logic per input.
  - **Pure input math is unit-tested** (`src/systems/joystickMath.js`); the DOM /
    pointer wiring lives in `src/legacy/game.js` (coverage-excluded), never in a
    new `src/input/` module (which the ratchet would then require ≥90% coverage on).
  - **Every touch UI element must resize fluidly to the actual screen — assume
    NO "standard" phone size.** Real devices range from ~280px-wide foldable cover
    screens through ~840px unfolded foldables and tablets, plus display-cutout/safe
    areas. So on the `body.touch` layer: lay out with fluid primitives — responsive
    grids (`repeat(auto-fill, minmax(min(100%, <floor>), 1fr))`, so a lone column
    can never exceed the viewport and columns are added only when they fit),
    `min()`/`max()`/`clamp()`, `%`/`dvh`, and `env(safe-area-inset-*)`. **Never a
    fixed `repeat(N, 1fr)` column count or a fixed-px `max-width` on a touch sheet**
    — both clip on a narrow screen (a `1fr` track won't shrink below its content's
    min-content, so fixed-px icons + text overflow) and waste half of a wide one.
    Any full-screen sheet must keep every control reachable at any size (scrollable,
    nothing buried by z-index or pushed off-screen). Verify the extremes (a ~280px
    cover screen and an ~840px foldable), not just one phone width.
  - Touch is verified end-to-end by `test/smoke/touch-controls.mjs` — keep it green.
- **Pull latest `main` before starting; work on a branch and open a PR — never
  commit straight to `main`.** Make reasonable decisions and implement them; land
  every change through a feature branch + PR so GitHub gates the merge. Resolve
  conflicts yourself, keeping both sides' intent. Only stop to ask if a request is
  genuinely impossible or self-contradictory.
  - **ALWAYS open a PR when you finish — then see it MERGED; don't stop at an open
    PR.** Once the work is committed, pushed, and green, open the PR into `main` (no
    need to ask first). A `claude/*` PR then auto-merges via
    `.github/workflows/auto-merge.yml`, which re-runs the full gate suite against the
    PR head and squash-merges only on green. That workflow fires on the PR event
    **and** on a 15-minute `schedule` sweep — the sweep is the backstop, because
    GitHub silently drops the per-PR `pull_request` event often enough that, without
    it, PRs are never evaluated and pile up open (this is exactly what stranded a
    batch of PRs before 2026-07-12). Pushing the branch is not "done", and neither is
    an open PR; a *merged* PR is.
  - **A stalled PR is yours to finish — don't leave it dirty.** Every change adds a
    `CHANGELOG` entry at the top of the same array, so any two PRs open at once
    conflict on `src/data/changelog.js` — only the first can merge cleanly; the rest
    go "dirty", and the auto-merge sweep deliberately SKIPS a conflicting PR rather
    than force-merge it. So land one change at a time, and if your PR falls behind
    `main` (usually just that changelog collision), rebase it onto latest `main` —
    re-stack the entry newest-first, keeping both sides — and push so it can merge.
- **All on-screen art is real pixel art — never an emoji as the thing itself.**
  Every game asset (heroes, enemies, bosses, NPCs, minions, items, pickups,
  projectiles, status icons, world objects) must be actual pixel-art imagery on the
  canvas **and** in menus/HUD — an atlas tile via `drawSpriteC`/`dlIcon(spriteKey,
  px)` or a bespoke sprite, never a raw emoji standing in for the asset. Emoji are
  fine only as plain section-header punctuation and as the brief pre-load fallback
  (`drawEmoji`/`dlIcon`). Procedural terrain (walls, floors, water, lava) stays
  procedural. We generate our own bespoke pixel art; ensure we can ship any new art.

## Architecture

Two invariants drive everything:

1. **Rendering is separable from simulation.** `systems/` (game logic) never
   imports `render/`, `ui/`, `audio/`, `persistence/`, or the DOM/network.
2. **Side effects live at the edges.** RNG, the clock, `fetch`, DOM and
   `localStorage` are **injected** into logic (or confined to the edge layers), so
   the core is deterministic and unit-testable.

### Directory taxonomy — what belongs where

| Layer | Contains | May import | Must NOT |
|---|---|---|---|
| `src/config/` | Tuning constants, environment (Supabase URL/key). Pure values. | — | logic |
| `src/data/` | Static content: item/affix/monster/class/skill tables, sprite-index tables, the `CHANGELOG`. Pure data. | — | `systems`/`render`/DOM |
| `src/assets/` | base64 art/font blobs + loaders. | — | logic |
| `src/utils/` | Pure, dependency-free helpers: `rng`, `color`, geometry, math, format. | other `utils` | game state, DOM, RNG-inline |
| `src/systems/` | Game logic / simulation (loot, stats, ratings, requirements, damage, buffs, combat, mapgen, skills, difficulty, cooking). Pure fns over injected state + rng + data. | `data`, `utils` | `render`/`ui`/`audio`/`persistence`/DOM/`fetch`/`Math.random`/`Date.now` |
| `src/state/` | Central mutable game state + explicit transitions. | `data`, `utils` | `render`/`ui`/network |
| `src/render/` | Canvas drawing (sprites, terrain, hero, particles, minimap). | `data`, `utils`, `state`, `assets` | be imported by `systems` |
| `src/audio/` | WebAudio engine, sfx, music, ambience. | `data`, `utils` | `systems` |
| `src/input/` | Keyboard/pointer handlers, keybind model. | `state`, dispatch into actions | own game logic |
| `src/ui/` | DOM panels/overlays/modals. Owns `innerHTML`. | `systems`, `render` (for icons), `state` | Supabase/`localStorage` directly |
| `src/persistence/` | **The only place Supabase + `localStorage` are touched** (repository pattern, injected `fetch`). | `data`, `utils` | game logic |
| `src/api/` | `window.gameState()` / `gameGuide()` console API. | reads `state`/`systems` | mutate state |
| `src/core/` | Game loop, fixed-timestep world clock, bootstrap. | anything (composition) | — |
| `src/main.js` | Composition root: import modules, inject effects, bridge handlers to `window`, start the loop. | anything | — |
| `src/legacy/` | Transitional monolith. Excluded from coverage. Shrinks to empty. | anything | grow |

### Dependency rules (enforced by review)

- `systems/` and `utils/` never import `render/`, `ui/`, `audio/`, `persistence/`,
  or touch `document`/`window`/`fetch`/`localStorage`.
- **All** Supabase and `localStorage` access goes through `persistence/`. Game logic
  never calls `fetch` or `localStorage` directly.
- `data/` is a leaf: pure values, importing nothing from `systems/`/`render/`.
- `render/` reads state but is never imported by `systems/`.
- Only `main.js` (composition root) wires concrete effects into logic.

### State management

- Mutable game state converges in `src/state/` with **explicit transitions** — no
  new scattered module-global mutated from everywhere. Read state where needed;
  mutate it through the state module's functions.
- During the migration, `src/legacy/game.js` still holds the god-object `player`
  and many globals; when you touch one, prefer moving it and its transitions into
  `state/` rather than adding another global.

### Side effects at the edges — inject RNG and the clock

- **Never call `Math.random()` or `Date.now()`/`new Date()` inside `systems/` or
  `utils/`.** Take an `rng` function (see `src/utils/rng.js`: `sysRandom` is the
  production default, `mulberry32` seeds a reproducible stream for tests) and a
  clock as parameters. Production passes the real ones (behavior-identical); tests
  pass deterministic ones.
- DOM, network and audio are effects too — keep them in `render/`/`ui/`,
  `persistence/`, `audio/`, and pass results into logic.

### Data-driven design

- Tuning constants, entity/content definitions, and level/tuning data live in
  `src/data/` (or `src/config/`), **not** hardcoded inside logic. Extract magic
  numbers into named data. Logic reads data; it doesn't embed it.

## Testing requirements

- **New logic ships with tests.** Extract a pure function → add a Vitest unit test
  the same commit. Add/adjust characterization tests when you change the shell
  contract (DOM ids, the console API, the save shape).
- **Mock Supabase — never hit the real backend.** Persistence tests inject a fake
  `fetch`/storage. No test performs real network I/O.
- **Coverage thresholds are enforced** over extracted `src/**` (90% lines/funcs/
  statements, 85% branches; legacy excluded). Adding a module without a test drops
  coverage and fails — that's the ratchet. Raise thresholds as coverage grows.
- **Keep the suite green and the game bootable at every commit.** Before pushing,
  run `npm test` (unit + characterization), `npm run build`, and `npm run smoke`
  (boots the real built game in Chromium and checks the full `gameState()` 38-key /
  `gameGuide()` 19-topic contract, the `window` handler bridge, and a live
  inline-`onclick` round-trip). Never land a red step or a state that doesn't boot.

## Performance — hot-path rules (from the 2026-07 lag audit)

The game lagged on deep floors and over long sessions until an audit fixed 50+
hot-path issues. **These rules keep the lag from coming back — follow them in any
edit that touches the frame loop, world tick, `draw()`, the HUD, or floor build.**

- **Never scan the whole map per frame.** Anything static within a floor (terrain,
  minimap terrain, decor/occluder lists) is baked once per floor to an offscreen
  canvas / prebuilt array and blitted; per-frame loops iterate only the visible
  tile window (`x0..x1`, `y0..y1`). A new draw pass must cull to the viewport the
  way the enemy loop does.
- **Invalidate, don't re-check.** The floor caches key on `floorSerial` +
  `_mapEpoch`; the pathfinding static grid listens to `pathGridDirty()`. **Any
  post-build `mapData`/`furnitureMap`/`decorMap` write must call `bumpMapEpoch()`
  (visuals) and `pathGridDirty()` (AI) as appropriate** — grep the existing call
  sites (shrine, fountain, cracked wall, vault door, spike disarm, boss carve)
  when adding one.
- **Never rebuild per entity what one tick can share.** Enemy AI reads the shared
  per-tick blocked grid, occupancy index (O(1) `getEnemyAt`), and status-flag map.
  No `enemies.find(...)` in movement/collision paths; no `statusEffects` rescans
  per enemy. Gear-derived stats go through the `loadoutEpoch` caches — call
  `bumpLoadout()` at every new gear/attribute mutation site.
- **The DOM is written only on change.** Per-frame/per-tick HUD writers compare
  against their last-rendered value and skip identical writes; element refs come
  from the cached lookups (`hudEl()` etc.), never `getElementById` per frame.
  Combat events call `markHudDirty()` — never `updateBars()` synchronously.
  Volatile text (cooldown seconds) lives in dedicated spans OUTSIDE any
  cached-innerHTML string, or the cache busts every second.
- **The combat log is a ring buffer** (`insertAdjacentHTML` + 200-line cap in
  `log()`). Never `innerHTML +=` onto a growing node anywhere.
- **No unbounded collections, no per-frame allocation in hot loops.** Particles
  are pooled and capped; caches carry size caps or per-floor replacement; arrays
  on the frame path compact in place (write-index) instead of `.filter()`; reuse
  module scratch buffers (BFS queue, A* fields, shake offset) rather than
  allocating per call.
- **Saves stay throttled and single-serialized.** The world tick autosaves;
  the heartbeat skips when a save is fresh; the cloud push reuses
  `_lastSavePayload`. Don't add `JSON.stringify`/`localStorage` calls to the
  frame or tick path.
- **Measure, don't guess:** `perfHud()` in the console toggles the frame-time /
  entity-count overlay. Any loop-touching change should keep worst-frame times
  flat on a deep floor before it merges.

## Design system — one source of truth for styling

Styling lives in `src/styles.css` (linked from `index.html`), driven by a shared
**design-token + component system**. Treat this as a hard rule.

- **Never hardcode a color, font, size, radius or spacing** — reference a token.
  All visual values are CSS custom properties in the `:root` block at the top of
  `src/styles.css`, in two layers: **primitives** (raw palette, prefer not to use
  directly) and **semantic aliases (use these)** — `--bg`, `--panel`, `--border`,
  `--text`, `--gold`, `--hp`, `--mp`, `--danger`, `--success`, the loot tiers
  (`--junk`…`--unique`), plus the scales (`--fs-*`, `--radius-*`, `--space-*`,
  `--shadow-*`, `--z-*`). A genuinely new role → add a new semantic token to
  `:root`, then use it. Canvas colors read from the JS mirror **`PALETTE`** (in
  `src/legacy/game.js`), which snapshots the UI-semantic tokens; bespoke pixel-art /
  particle / procedural-terrain colors stay art, not tokens.
- **Reuse the canonical components** (`.shop-row` + `.act-btn`, `.modal-head` +
  `.modal-nav-btn`, the shared tooltip `placeTooltipBesideAnchor()` helper, loot
  icons via `dlIcon`) rather than reinventing arrangements. Rows with their own
  `.act-btn` get `.has-actions` (only the button acts).
- **Overriding a template — always ask first.** If a request would one-off a token,
  component class, or layout, point out the cohesion cost and ask whether to change
  it everywhere (the default) or make a deliberate, code-commented one-off.
- **Guard:** run `node tools/styles-lint.js` before committing UI changes (it flags
  hardcoded hex, off-scale sizes, and raw `rgba()` that bypass the token system).

## Keep the AI-play API in sync (`gameState()` / `gameGuide()`)

Two console functions let an external agent play without reading pixels — keep
**both** truthful on every gameplay change (the smoke test pins their shape):

- **`gameState(radius)`** — live snapshot of WHAT is happening (ASCII map + glyph
  `legend`, hero stats/buffs, skills, enemies, loot, hazards, shrines, NPCs, menu/
  overlay state). New live state an agent must see → add it here (and to the ASCII
  overlay + `legend` if it gets a glyph).
- **`gameGuide(topic)`** — the how-to reference (rules, formulas, controls). New or
  changed rules → edit the matching topic (add a topic + aliases for a new system).
- **Fix stale references, don't just append**, and verify field/helper/keybind names
  still exist after editing.

## Version history (changelog)

The in-game Version History popup is driven by the `CHANGELOG` array in
`src/data/changelog.js`. When adding/editing entries:

- **Never reference other games** (no "Diablo-style", "Golden Sun palette",
  "roguelike", etc.) — describe what the change does in plain terms. This is
  player-facing copy and must stand on its own. (A data-validity test enforces this.)
- Keep the existing shape (`date`, `size`, `v`, `by`, `notes`), newest-first.
- **Date each entry by the Pacific (America/Los_Angeles) calendar day it ships —
  never UTC.** The Version History popup groups entries under a per-day heading, so
  a UTC date lands an evening change under the next day. Your environment clock is
  usually UTC: derive the Pacific day (e.g. `TZ=America/Los_Angeles date +%F`)
  rather than trusting a UTC "today". A data-validity test enforces this — it fails
  if any entry is dated after the current Pacific day, so a UTC-drifted date breaks
  CI instead of silently shipping under tomorrow.
- **Add an entry for every user-facing change you ship, in the same commit.**
- **Be maximally concise** — present-tense fragments, drop articles/hedges, ~one
  line each.

## Loot tiers & typography

- The loot tiers (grey → white → green → blue → purple → orange → red) communicate
  rarity by **color only** — never re-add text rarity labels.
- **Type scale, respect the floor:** no DOM text below `1.1rem`, no canvas text
  below `12px` (`Math.max(12, …)`). Pick the tier that matches the role
  (`1.1` fine · `1.2` secondary · `1.3` body · `1.5` small heading · `1.6–2` section
  · `2.2+` display) — don't invent in-between sizes.

## Layout: no "loners" (orphans & widows)

Avoid stranded single elements — a lone trailing grid tile, a one-word last line,
a single item in a row. Centre a lone trailing tile (or add a genuinely useful one
— never filler); tighten wording or use `&nbsp;` to avoid one-word last lines.
Apply this proactively on every UI change.

## Naming & file organization

- Modules are small and cohesive (one responsibility). Group by layer (above), not
  by feature-across-layers. File names are `camelCase.js` matching their main
  export cluster (`skillMath.js`, `ratings.js`). Tests mirror the source path under
  `test/` (`test/systems/ratings.test.js`).
- Keep code readable over clever — this stays an approachable, "vibe-coded" project.
- Preserve the `localStorage` save system: changing a saved field can break existing
  saves, so migrate or reset older saves gracefully (via the persistence layer).

## When adding a feature — the checklist

1. **Branch off latest `origin/main`** (`claude/<short-topic>`).
2. **Put code in the right layer** (taxonomy above). Pure logic → `systems/` with
   injected `rng`/clock; content/tuning → `data/`; DOM → `ui/`; drawing → `render/`;
   any Supabase/`localStorage` → `persistence/` only.
3. **Extract magic numbers to `data/`/`config/`**; don't hardcode in logic.
4. **Add tests** the same commit (unit for new logic; mock Supabase for persistence;
   update characterization if the shell contract changed).
5. **Update `gameState()` / `gameGuide()`** if the change adds/alters live state or
   rules.
6. **Add a `CHANGELOG` entry** (in `src/data/changelog.js`) for any user-facing
   change, same commit.
7. **Run `node tools/styles-lint.js`** for UI changes.
8. **Verify green:** `npm test`, `npm run build`, `npm run smoke` — all pass and the
   game boots. Update `docs/CHANGELOG.md` if you moved code between modules.
9. **Commit** with a clear message (`feat:`/`fix:`/`balance:`/`ui:`/`refactor:`/
   `docs:`), **push the branch, open a PR into `main`**, resolve any conflicts, and
   merge once green.

## Before pushing

Run `npm test` + `npm run build` + `npm run smoke`. The game silently fails to load
on a syntax/boot error, so these three gates — not a manual eyeball — are the safety
net. Never leave `main` in a non-bootable or red state (Netlify auto-deploys it).
