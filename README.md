# Dungeon Loot

A loot-based pixel RPG that runs entirely in the browser — a Diablo-style dungeon
crawl with color-coded loot tiers, skill trees, crafting, cooking, a town hub,
cloud saves, and global leaderboards. Canvas 2D rendering, a DOM HUD, and a
generative WebAudio soundtrack, with **zero third-party runtime dependencies**.

The game was originally a single ~30k-line `index.html`. It is being refactored,
incrementally and behavior-preserving, into a modular ES-module codebase built to
a **static bundle** with [Vite](https://vitejs.dev/) — still deployable as plain
static files on Netlify / GitHub Pages.

---

## Quick start

```bash
npm install          # one-time (dev tooling only; nothing ships to players)
npm run dev          # Vite dev server with HMR  → http://localhost:5173
npm run build        # production static bundle   → dist/
npm run preview      # serve the built dist/ locally
npm test             # unit + characterization tests (Vitest)
npm run test:cov     # tests with coverage (thresholds enforced)
npm run smoke        # boot the built game in real Chromium and check it works
npm run lint:styles  # design-token guard over src/styles.css
```

There is no global install and no backend to run locally — the game talks to a
hosted Supabase project for cloud saves / leaderboards, and falls back to
`localStorage` when offline.

## Deploying (Netlify / GitHub Pages)

The build output in `dist/` is a self-contained static site.

- **Build command:** `npm ci && npm run build`
- **Publish directory:** `dist`
- **Base path:** the Vite config uses `base: './'`, so the bundle uses **relative**
  URLs and works whether it is served from a domain root (Netlify) or a project
  subpath (`https://user.github.io/repo/`, GitHub Pages) — no per-host base-path
  changes needed.

`dist/` and `coverage/` are git-ignored; hosts build them from source on deploy.

---

## Architecture

Two hard invariants drive the structure:

1. **Rendering is separable from simulation.** Game logic (`systems/`) never
   imports rendering or the network. Effects live at the edges.
2. **Effects are injected, not reached for.** RNG, the clock, `fetch`, DOM and
   `localStorage` are passed in (or confined to `persistence/`, `render/`,
   `ui/`, `audio/`, `input/`), so the core is deterministic and testable.

### Directory taxonomy

```
index.html          App shell: <head> + body markup + <link> css + module entry.
src/
  main.js           Composition root — imports modules, injects effects, boots.
  config/           Tuning constants & environment (pure values).
  data/             Static content: item/affix/monster/class/skill tables, the
                    CHANGELOG, sprite-index tables. Pure data, no logic.
  assets/           base64 art/font blobs + loaders. Leaf; imported by render.
  utils/            Pure, dependency-free helpers (rng, color, geometry, math).
  systems/          Game logic / simulation — pure fns over injected state+rng+data
                    (loot, stats, ratings, requirements, damage, buffs, combat,
                    mapgen, skills, difficulty, cooking). NEVER imports render/DOM.
  state/            Central mutable game state + explicit transitions.
  render/           Canvas drawing (sprites, terrain, hero, particles, minimap).
  audio/            WebAudio engine, sfx, music, ambience.
  input/            Keyboard/pointer/touch handlers + keybind model.
  ui/               DOM panels/overlays/modals (shop, town, settings, bag, …).
  persistence/      The ONLY place Supabase + localStorage are touched
                    (repository pattern, injected fetch — mockable in tests).
  api/              window.gameState() / gameGuide() — the AI-play console API.
  legacy/           Transitional monolith (game.js) — code not yet extracted.
tools/              Dev-only scripts (styles-lint). Not shipped.
test/               Vitest unit + characterization tests, and the smoke driver.
docs/               DISCOVERY, DECISIONS, CHANGELOG, BUGS.
```

### Dependency rules

- `systems/` and `utils/` do **not** import `render/`, `ui/`, `audio/`,
  `persistence/`, or touch `document`/`window`/`fetch`/`localStorage`.
- **All** Supabase and `localStorage` access goes through `persistence/`.
- `data/` is a leaf (pure values, importing nothing from `systems/`/`render/`).
- `render/` reads state but is never imported by `systems/`.
- Only `main.js` wires concrete effects into logic.

See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the full rationale and
[`CLAUDE.md`](CLAUDE.md) for the rules future edits must follow.

### Migration status (strangler pattern)

The refactor is incremental and the game stays fully working and deployable at
every commit. The original inline script now lives in `src/legacy/game.js`
(loaded as an ES module via `src/main.js`); a transitional `window` bridge keeps
the ~250 inline HTML `on*=` handlers resolving while logic is carved out into real
`src/` modules one cluster at a time. [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
tracks exactly what has moved where.

Already extracted (pure, 100%-covered): `utils/rng`, `utils/color`,
`systems/skillMath`, `systems/ratings`, `data/changelog`.

---

## Testing

- **Unit tests** (Vitest, jsdom) cover extracted pure logic and data validity.
- **Characterization/baseline tests** guard the monolith while it shrinks: a
  strict-ESM parse gate over all `src/`+`test/` modules, and a structure gate over
  the HTML shell (critical DOM ids, Supabase config, console API surface, the
  `window` bridge).
- **Smoke test** (`npm run smoke`) boots the real built game in headless Chromium
  and asserts the full behavioral contract: `gameState()`'s 33 keys,
  `gameGuide()`'s 18 topics, a sized canvas, the whole inline-handler bridge, live
  state accessors, and a real inline-`onclick` round-trip. Runs against source-built
  `dist/`.
- **Coverage thresholds** (90% lines/functions/statements, 85% branches) are
  enforced over extracted `src/**` (the legacy monolith is excluded until carved
  out). New logic ships with tests; Supabase is always mocked — tests never hit
  the real backend.

### Manual smoke checklist (core loops)

When automated coverage can't reach a change, verify by hand in `npm run dev`:

1. **Boot** — title screen renders; Play starts a class; the dungeon draws.
2. **Move & fight** — WASD/arrows move; auto-attack and a cast skill deal damage;
   HP/MP/XP bars update; a kill drops loot.
3. **Loot & gear** — pick up an item; open the bag; equip it; stats change.
4. **Descend** — clear the floor; take the stairs; a new floor generates.
5. **Town** — portal to town; buy/sell at the shop; craft/enchant/cook.
6. **Persistence** — reload the page; the save restores. Sign in (Cloud Save);
   the leaderboard loads.
7. **Console API** — `gameState()` and `gameGuide()` return sane objects.

---

## License / credits

See [`CREDITS.md`](CREDITS.md) (art) and [`LEADERBOARD.md`](LEADERBOARD.md) /
[`CLOUD_SAVES.md`](CLOUD_SAVES.md) (backend setup).
