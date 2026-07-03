# Refactor CHANGELOG — what moved where

A running, newest-first log of the modularization. This tracks **structure**
(code relocation, tooling) — it is distinct from the in-game `CHANGELOG` array in
`index.html` (which is player-facing patch notes). Each entry keeps the build +
test suite + smoke green.

> Legend: 🏗️ tooling · 📦 extraction (code moved out of the monolith) · 🧪 tests ·
> 📄 docs

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
