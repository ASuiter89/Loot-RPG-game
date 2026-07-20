import { describe, it, expect } from 'vitest';
import { TIER_KEYS, CB_MODES, CB_PALETTES } from '../../src/data/colorblindPalettes.js';

const HEX6 = /^#[0-9a-f]{6}$/;

describe('colourblind palette data', () => {
  it('TIER_KEYS is the eight rarity tiers ending in the set class', () => {
    expect(TIER_KEYS).toEqual(['junk', 'normal', 'uncommon', 'rare', 'epic', 'legendary', 'unique', 'set']);
  });

  it('CB_MODES lists Off first, then the three deficiency types', () => {
    expect(CB_MODES[0]).toEqual({ id: '', label: 'Off' });
    expect(CB_MODES.map((m) => m.id)).toEqual(['', 'deuter', 'protan', 'tritan']);
    for (const m of CB_MODES) {
      expect(typeof m.label).toBe('string');
      expect(m.label.length).toBeGreaterThan(0);
    }
  });

  it('every non-Off mode has a palette; Off has none', () => {
    const paletteless = CB_MODES.filter((m) => m.id === '');
    for (const m of paletteless) expect(CB_PALETTES[m.id]).toBeUndefined();
    for (const m of CB_MODES.filter((m) => m.id !== '')) {
      expect(CB_PALETTES[m.id], `${m.id} palette`).toBeTruthy();
    }
    // No stray palettes that aren't offered as a mode.
    const offered = new Set(CB_MODES.map((m) => m.id));
    for (const id of Object.keys(CB_PALETTES)) expect(offered.has(id), `${id} is offered`).toBe(true);
  });

  it('each palette colours all eight tiers with a valid 6-digit hex', () => {
    for (const [id, pal] of Object.entries(CB_PALETTES)) {
      expect(Object.keys(pal).sort(), `${id} keys`).toEqual([...TIER_KEYS].sort());
      for (const key of TIER_KEYS) {
        expect(pal[key], `${id}/${key}`).toMatch(HEX6);
      }
    }
  });

  it('keeps the neutral tiers (grey junk, light normal) across every palette', () => {
    for (const [id, pal] of Object.entries(CB_PALETTES)) {
      expect(pal.junk, `${id} junk`).toBe('#6b6b6b');
      expect(pal.normal, `${id} normal`).toBe('#f0f0f0');
    }
  });

  it('every colour within a palette is distinct (no two tiers collide)', () => {
    for (const [id, pal] of Object.entries(CB_PALETTES)) {
      const cols = TIER_KEYS.map((k) => pal[k].toLowerCase());
      expect(new Set(cols).size, `${id} distinct colours`).toBe(TIER_KEYS.length);
    }
  });
});
