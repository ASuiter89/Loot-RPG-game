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

let html;
let doc;

beforeAll(() => {
  html = readFileSync(INDEX, 'utf8');
  doc = new JSDOM(html).window.document;
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

  it('carries an inline <style> design-token block', () => {
    const style = doc.querySelector('style');
    expect(style).toBeTruthy();
    expect(style.textContent).toContain(':root');
    expect(style.textContent).toContain('--gold');
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

describe('embedded configuration & console API', () => {
  it('embeds the Supabase leaderboard/cloud config', () => {
    expect(html).toMatch(/const LB_SUPABASE_URL\s*=/);
    expect(html).toMatch(/const LB_SUPABASE_KEY\s*=/);
  });

  it('exposes the gameState/gameGuide AI-play API on window', () => {
    expect(html).toMatch(/window\.gameState\s*=/);
    expect(html).toMatch(/window\.gameGuide\s*=/);
  });

  it('drives the in-game changelog from a CHANGELOG array', () => {
    expect(html).toMatch(/const CHANGELOG\s*=\s*\[/);
  });
});

describe('inline event-handler surface', () => {
  it('has the large inline on*= handler surface the game relies on', () => {
    const handlers = html.match(/\son[a-z]+="/g) || [];
    // ~253 across the file at baseline; assert it is clearly present.
    expect(handlers.length).toBeGreaterThan(150);
  });
});
