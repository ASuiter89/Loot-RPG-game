# Refactor CHANGELOG — what moved where

A running, newest-first log of the modularization. This tracks **structure**
(code relocation, tooling) — it is distinct from the in-game `CHANGELOG` array in
`index.html` (which is player-facing patch notes). Each entry keeps the build +
test suite + smoke green.

> Legend: 🏗️ tooling · 📦 extraction (code moved out of the monolith) · 🧪 tests ·
> 📄 docs

## Phase 4 — incremental pure-module extraction (with tests)

Each increment: move a self-contained pure cluster verbatim into a `src/` module,
replace its definition in `game.js` with an `import`, add unit tests, and verify
`vite build` + smoke (behavior identical) + suite green.

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
