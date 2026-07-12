import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

// CHARACTERIZATION TEST — locks the HTML shell contract the game depends on.
//
// The JS reaches the DOM by a fixed set of element ids (a hard contract between
// markup and script), mounts a single game <canvas>, embeds the Supabase config,
// and exposes the gameState/gameGuide console API. If a refactor step
// accidentally drops one of these, this test fails before the game breaks in a
// browser. JSDOM parses the markup here WITHOUT running any scripts.

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(__dirname, '../../index.html');

const GAME = resolve(__dirname, '../../src/legacy/game.js');

let html;
let doc;
let game;

beforeAll(() => {
  html = readFileSync(INDEX, 'utf8');
  doc = new JSDOM(html).window.document;
  game = readFileSync(GAME, 'utf8');
});

describe('document shell', () => {
  it('is a titled HTML document', () => {
    expect(doc.querySelector('title')?.textContent).toMatch(/Dungeon Loot/i);
    expect(doc.querySelector('meta[name="viewport"]')).toBeTruthy();
  });

  it('has exactly one main game canvas (#canvas)', () => {
    expect(doc.getElementById('canvas')).toBeTruthy();
    expect(doc.getElementById('canvas').tagName).toBe('CANVAS');
  });

  it('has the minimap overlay canvas (#minimap)', () => {
    expect(doc.getElementById('minimap')).toBeTruthy();
  });

  it('links the externalized stylesheet with its design-token block', () => {
    const link = doc.querySelector('link[rel="stylesheet"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('./src/styles.css'); // relative — see note above

    const css = readFileSync(resolve(__dirname, '../../src/styles.css'), 'utf8');
    expect(css).toContain(':root');
    expect(css).toContain('--gold');
  });
});

describe('critical DOM ids (markup↔script contract)', () => {
  // A representative slice of the ids the script reads by getElementById across
  // HUD, panels, overlays and modals. Not exhaustive — a tripwire, not a census.
  const REQUIRED_IDS = [
    // HUD / vitals
    'hp-bar', 'mp-bar', 'xp-bar', 'gold-count', 'power-num', 'floor-num',
    // desktop HUD
    'desktop-hud', 'dh-hp-fill', 'dh-mp-fill',
    // panels / play area
    'game-wrap', 'side-panel', 'panel-content', 'skill-bar', 'log',
    // town / shop / mystic
    'town-overlay', 'town-content', 'shop-overlay', 'shop-content',
    'mystic-overlay', 'mystic-content',
    // meta overlays
    'settings-menu', 'death-overlay', 'version-overlay', 'achievements-overlay',
    'lb-overlay',
    'title-overlay', 'class-overlay', 'name-overlay', 'slots-overlay',
    'account-overlay', 'keybind-overlay',
    // tooltips
    'tooltip', 'hovertip', 'enemy-card',
  ];

  it.each(REQUIRED_IDS)('has #%s', (id) => {
    expect(doc.getElementById(id), `missing #${id}`).toBeTruthy();
  });
});

describe('embedded configuration & console API (now in src/legacy/game.js)', () => {
  it('embeds the Supabase leaderboard/cloud config', () => {
    expect(game).toMatch(/const LB_SUPABASE_URL\s*=/);
    expect(game).toMatch(/const LB_SUPABASE_KEY\s*=/);
  });

  it('exposes the gameState/gameGuide AI-play API on window', () => {
    expect(game).toMatch(/window\.gameState\s*=/);
    expect(game).toMatch(/window\.gameGuide\s*=/);
  });

  it('drives the in-game changelog from a CHANGELOG array (now in src/data/changelog.js)', () => {
    const changelog = readFileSync(resolve(__dirname, '../../src/data/changelog.js'), 'utf8');
    expect(changelog).toMatch(/export const CHANGELOG\s*=\s*\[/);
    expect(game).toMatch(/import \{ CHANGELOG \}/);
  });

  it('appends the transitional window bridge', () => {
    expect(game).toContain('__DL_FN_BRIDGE');
    expect(game).toMatch(/__dlLive\("player"/);
  });
});

describe('enemy sprite-key integrity', () => {
  // An enemy's `type` is a sprite-lookup key (MONSTER_SPRITE_IDX / MONSTERS). A
  // copy-paste slip once set a risen grave-loot foe's `type` to an HTML log
  // snippet ('<span data-spr=e_zombie></span>') instead of 'zombie', so it
  // matched no sprite table and rendered as a permanent "?" placeholder box
  // (three of them, spawned when disturbing a grave). No enemy type is ever
  // legitimately markup — guard the whole shape from coming back.
  it('never assigns an enemy type to an HTML/markup string', () => {
    const bad = game.match(/(?:\.type\s*=|\btype:)\s*['"]\s*</g) || [];
    expect(bad, `enemy type assigned a markup string:\n${bad.join('\n')}`).toEqual([]);
  });
});

describe('History records every ended run (graveyard headstones)', () => {
  // REGRESSION GUARD — a hero that ends via Reset Run has always earned a History
  // headstone (recordFallenHero), but deleting a save slot or overwriting one with
  // a New Game used to destroy the hero WITHOUT recording it, so those runs
  // vanished from History. Every intentional slot-destruction path must file a
  // headstone before it clears the slot. We slice each function's source and
  // assert the record call is present.
  const fnBody = (src, name) => {
    const start = src.indexOf(`function ${name}(`);
    expect(start, `missing function ${name}`).toBeGreaterThan(-1);
    // Up to the next top-level function declaration — enough to cover the body.
    const rest = src.slice(start + 1);
    const next = rest.indexOf('\nfunction ');
    return next === -1 ? rest : rest.slice(0, next);
  };

  it('files a headstone when a slot is deleted', () => {
    expect(fnBody(game, 'deleteSlot')).toMatch(/recordFallen/);
  });

  it('files a headstone when a slot is overwritten by a New Game', () => {
    expect(fnBody(game, 'newGameInSlot')).toMatch(/recordFallen/);
  });

  it('still files a headstone on Reset Run', () => {
    expect(fnBody(game, 'wipeSave')).toMatch(/recordFallenHero/);
  });

  it('can record a fallen hero from a saved slot, not just the live player', () => {
    // recordFallenHero takes a player arg (defaulting to the live `player`) so a
    // slot you are NOT currently playing can still be recorded from its bytes.
    expect(game).toMatch(/function recordFallenHero\(p\b/);
    expect(game).toMatch(/function recordFallenSlot\(/);
  });
});

describe('index.html module wiring', () => {
  it('loads the game as an ES module entry via a RELATIVE path', () => {
    // Relative paths keep the app working at any mount point — the domain root
    // (Netlify) AND a project subpath (GitHub Pages, e.g. /Loot-RPG-game/).
    // An absolute "/src/..." resolves to the domain root and 404s on a subpath.
    expect(html).toMatch(/<script\s+type="module"\s+src="\.\/src\/main\.js"><\/script>/);
    expect(html, 'asset paths must be relative (not /src/…) for GitHub Pages subpaths').not.toMatch(/(?:src|href)="\/src\//);
  });

  it('still carries the static inline on*= handler surface in markup', () => {
    // JS-generated handlers moved into game.js; the static body handlers remain.
    const handlers = html.match(/\son[a-z]+="/g) || [];
    expect(handlers.length).toBeGreaterThan(50);
  });
});
