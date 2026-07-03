# Architecture Decisions Log — Dungeon Loot modularization

Newest entries at the bottom of each section. Each decision records **context →
decision → rationale → consequences**. This is the source of truth for _why_ the
structure is the way it is; the _how-to_ for future edits lives in the root
[`CLAUDE.md`](../CLAUDE.md).

---

## D0. The single-file → modular pivot (and the tension it resolves)

**Context.** The shipped `CLAUDE.md` states a hard rule: "Keep the game in one
file … do not introduce a bundler — the single-file design is intentional so the
game stays trivially shareable and hostable." The current task, by contrast,
explicitly directs a modular ES-module refactor with Vite + Vitest, a
`src/` taxonomy, a repository layer, full tests, and a **rewritten `CLAUDE.md`
codifying the modular architecture**.

**Decision.** Proceed with the modular refactor as the newer, explicit, detailed
instruction, and **replace the single-file rule** in `CLAUDE.md` with the modular
rules — while preserving the property the old rule actually protected:
**the deployed artifact stays static files** with **no runtime dependencies**.
Vite's production build outputs exactly that (`dist/` = static HTML/CSS/JS/assets),
so Netlify / GitHub Pages hosting is unaffected.

**Rationale.** The two constraints that matter to the user — *ship static files*
and *stay trivially hostable* — are honored by a static bundler. What changes is
the **authoring** model (many small modules) versus the **artifact** model (one
bundle). The task is unambiguous and repeated, and instructs the `CLAUDE.md`
rewrite directly, so this is a deliberate, authorized pivot, not drift.

**Consequences.** `index.html` stops being the source of truth for logic and
becomes the app **shell**; source lives in `src/`. Contributors now run
`npm install` once and `npm run dev` / `npm test`. The single-file guarantee is
replaced by a "single static bundle" guarantee enforced by `npm run build`.

---

## D1. Build tool: Vite

**Decision.** Vite 5, `base: './'`, build to `dist/`.

**Rationale.** Vite gives real ES-module dev ergonomics (`npm run dev` with HMR),
a static production build, and first-class Vitest integration (shared config).
`base: './'` emits **relative** asset URLs, so the same bundle works served from a
domain root (Netlify) **or** a project subpath (GitHub Pages) with no per-host
base surgery — the one GitHub-Pages footgun, sidestepped.

**Verified.** `vite build` on the untouched baseline emits a byte-identical
`dist/index.html`; the Playwright smoke passes against both source and `dist`.

**Consequences.** `dist/` and `coverage/` are git-ignored (generated). The deploy
step becomes `npm ci && npm run build` publishing `dist/` (documented in README).

## D2. Test stack: Vitest + jsdom + Playwright

**Decision.** Vitest (unit + characterization, jsdom env), Playwright against the
pre-installed Chromium (behavioral smoke). Coverage via `@vitest/coverage-v8`.

**Rationale.** Vitest shares Vite's config/transform, so modules test exactly as
they build. jsdom covers DOM-touching helpers. The full game cannot run under
jsdom (no real canvas), so a **real browser** smoke is the only honest "it still
boots" gate — and Chromium is pre-installed here. Coverage is scoped to
**extracted** `src/**` modules (the legacy monolith is excluded) so the threshold
measures tested logic, not the not-yet-carved blob.

**Consequences.** Three gates run green at every step: `npm test` (unit +
characterization), `npm run build`, `npm run smoke`. Coverage thresholds
(90/90/85/90) are enforced and **raised as extraction proceeds**; because
coverage `include` is `src/**` minus `src/legacy/**` and `src/main.js`, adding a
module without a test drops coverage and fails CI — the intended ratchet.

## D3. Baseline characterization before touching logic

**Decision.** Lock behavior first: (a) a **syntax gate** that `vm`-compiles every
inline script in `index.html`; (b) a **structure gate** (jsdom) asserting the
~30 critical DOM ids, the Supabase config, the `window.gameState/gameGuide`
exposure, and the inline-handler surface; (c) a **Playwright smoke** that boots
the real game and pins the **full** `gameState()` 33-key contract and
`gameGuide()` 18-topic contract; plus a manual smoke checklist in the README.

**Rationale.** "Preserve exact runtime behavior" needs a tripwire. These three
catch the ways a refactor step silently breaks the game (syntax error → blank
page; dropped id → broken panel; changed API shape → misplaying agents) before it
ships.

---

## D4. Target directory taxonomy

Dependencies point **downward** only. High-level game logic never imports render
or network details; it depends on data/utils and receives effects (DOM, network,
RNG, clock) injected from the composition root (`src/main.js`).

```
src/
  config/        Tuning constants & environment (TILE, map sizes, Supabase URL/key). Pure values.
  data/          Static content: item/affix tables, monsters, bosses, classes, skills,
                 weapons, food/recipes, difficulty, sprite-index tables, the CHANGELOG.
                 Pure data — no logic, no imports of systems/render.
  assets/        The base64 art/font blobs + a loadImage() helper. Leaf; imported by render.
  utils/         Pure, dependency-free helpers: rng (injectable), geometry/grid, math,
                 formatting, color. No game knowledge, no DOM.
  systems/       Game logic / simulation. Pure functions over injected state + rng + data:
                 loot, stats, ratings, requirements, damage, buffs, combat, mapgen,
                 skills, difficulty, cooking, progression. NEVER imports render/ or DOM.
  state/         The central mutable game state (the player/world store) + explicit
                 transitions. The one place scattered globals converge.
  render/        Canvas drawing: sprites, terrain, hero, particles, HUD-on-canvas,
                 minimap. Reads state + data; imported by the loop, never by systems.
  audio/         WebAudio engine, sfx, music, ambience. Effect at the edge.
  input/         Keyboard/pointer/touch handlers + keybind model. Dispatches to actions.
  ui/            DOM panels/overlays/modals (shop, town, settings, bag, leaderboard…).
                 May call systems for data and render for icons; owns innerHTML.
  persistence/   The ONLY place Supabase and localStorage are touched (repository pattern):
                 supabaseClient (injected fetch), saveRepo, leaderboardRepo, authRepo,
                 localStore, and the pure reconcile()/migrateSave() logic.
  core/          The game loop, fixed-timestep world clock, bootstrap wiring.
  api/           window.gameState() / gameGuide() — the AI-play console API (behavior-locked).
  main.js        Composition root: imports everything, wires effects, bridges the 171
                 handler functions to window, starts the loop. (Excluded from coverage.)
  legacy/        Transitional home for not-yet-extracted monolith code during the
                 strangler migration. Excluded from coverage. Shrinks to empty.
```

**Rationale.** The split is by **responsibility** and follows the discovered
seams: the inventory showed a large **pure data + pure derivation** core
(items/stats/ratings/skills), a **pure-able simulation** core (damage/buffs/
geometry/mapgen once RNG is injected), an **isolatable persistence** layer (all
`fetch` behind one seam), and hard-to-purify **DOM UI** + **render** + **audio**
that stay as thin effectful edges. `state/` exists because 552 scattered globals
need one convergence point with explicit transitions.

## D5. Dependency rules (enforced by convention + review)

1. `systems/` and `utils/` must not import `render/`, `ui/`, `audio/`,
   `persistence/`, or touch `document`/`window`/`fetch`/`localStorage` directly.
2. **All** Supabase and `localStorage` access goes through `persistence/`. Game
   logic never calls `fetch` or `localStorage` directly.
3. **Side effects at the edges**: RNG and clock are **injected** (`rng()` and a
   `now()`/clock), never `Math.random()`/`Date.now()` inline inside `systems/`.
4. `data/` is leaf — pure values, importing nothing from `systems/`/`render/`.
5. `render/` reads state but is never imported by `systems/` (rendering separable
   from simulation).
6. The composition root (`main.js`) is the only module that wires concrete
   effects into logic and the only one allowed to reach broadly.

## D6. Migration strategy: strangler + `window` bridge

**Context.** 253 inline `on*=` handlers bind **171 global functions** by name,
and console helpers are `window.gameState/gameGuide`. A naive "convert the inline
script to a module" breaks all of them (module scope ≠ global), and a big-bang
rewrite violates "working build at every commit / preserve exact behavior."

**Decision.** Strangle the monolith incrementally:

1. Move the inline `<script>` body verbatim into `src/legacy/game.js` and load it
   through Vite as a module from `src/main.js`. **Bridge** every inline-handler
   function and the console API to `window` explicitly (an allow-listed
   `Object.assign(window, {...})`), so behavior is identical. Externalize the
   inline `<style>` to `src/styles/`.
2. Then carve **leaf, low-risk** pieces out of `src/legacy/` into real `src/`
   modules with real `import`s, each with unit tests, **verifying green after
   every carve**: pure `utils/` → pure `data/` tables → pure `systems/` formulas
   → the `persistence/` repository (injected `fetch`, fully mockable). The legacy
   file re-imports the extracted symbols so the running game is unchanged.
3. `state/`, `render/`, `ui/`, `input/`, `core/` follow last, since they are the
   most effect-entangled.

**Rationale.** Each step is small, reversible, and independently verifiable by
the three gates. The `window` bridge is a well-understood, temporary seam that
lets the DOM markup keep working untouched while the JS de-monoliths underneath
it. Pure/data/persistence first because they carry the most test value for the
least behavioral risk (the discovery reports rank `ratings`, `requirements`,
`power`, `loot`, and `persistence` as highest-leverage first targets).

**Consequences.** For a while, `src/legacy/game.js` is large and excluded from
coverage; that is expected and tracked in [`CHANGELOG.md`](./CHANGELOG.md). The
end state has `src/legacy/` empty and `main.js` as an explicit bootstrap.

## D7. Injected RNG and clock

**Decision.** Introduce `src/utils/rng.js` now (seedable `mulberry32` +
`sysRandom` default + `rndInt/pick/chance/shuffle` helpers mirroring the game's
shapes). Extracted logic takes an `rng` parameter; production passes `sysRandom`
(behavior-identical to `Math.random`), tests pass a seeded stream.

**Rationale.** 164 inline `Math.random()` calls make the game non-deterministic
and untestable. Injecting RNG is the enabling move for testing loot, combat, and
mapgen without changing shipped behavior (the default RNG is still the platform
PRNG). Same pattern will apply to the clock for time-dependent logic.

## D8. Persistence as a repository with injected `fetch`

**Decision.** One `persistence/supabaseClient.js` owns the URL/key and an
**injected `fetch`**; `saveRepo`/`leaderboardRepo`/`authRepo` expose intent-level
methods; `localStore` wraps `localStorage` behind an injectable storage; the
intricate `cloudReconcile` and `loadGame` migration ladder become **pure**
`reconcile(local, cloud)` / `migrateSave(data)` functions with separate appliers.

**Rationale.** The discovery found `fetch` called un-injected at ~15 sites with
ad-hoc headers — impossible to mock without stubbing globals. Centralizing behind
one seam makes the whole cloud/leaderboard/auth surface mockable from one place,
lets the reconcile/migration math be unit-tested as pure functions, and keeps the
hardcoded credential in exactly one module. Tests **never** hit the real backend.

---

## Risks & open questions

- **Scope**: a full 24k-line extraction with byte-for-byte behavior parity is
  large. Mitigation: the strangler keeps the game shippable and green at every
  commit, so progress is monotonic and safe even if extraction is incomplete in a
  given session. `CHANGELOG.md` tracks exactly what has moved.
- **`gameState`/`gameGuide` drift**: locked by the full-contract smoke (D3).
- **Save compatibility**: the migration ladder must be extracted **behavior-
  preserving**; covered by round-trip tests against fixtures (mocked storage).
- **Bugs found during discovery are logged, not fixed** (see `BUGS.md`) to keep
  this a pure refactor.
