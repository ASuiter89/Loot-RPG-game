import { describe, it, expect } from 'vitest';
import { cbModeIds, isCbMode, normalizeCbMode, paletteFor, cbTierColor, cbTierKeys } from '../../src/systems/colorblind.js';
import { CB_PALETTES } from '../../src/data/colorblindPalettes.js';

describe('colourblind mode resolution', () => {
  it('cbModeIds lists Off plus the three deficiency modes', () => {
    expect(cbModeIds()).toEqual(['', 'deuter', 'protan', 'tritan']);
  });

  it('isCbMode accepts only real deficiency modes', () => {
    expect(isCbMode('deuter')).toBe(true);
    expect(isCbMode('protan')).toBe(true);
    expect(isCbMode('tritan')).toBe(true);
    expect(isCbMode('')).toBe(false);
    expect(isCbMode('off')).toBe(false);
    expect(isCbMode('nope')).toBe(false);
    expect(isCbMode(null)).toBe(false);
    expect(isCbMode(undefined)).toBe(false);
    expect(isCbMode(42)).toBe(false);
  });

  it('normalizeCbMode passes valid modes and defaults everything else to Off', () => {
    expect(normalizeCbMode('deuter')).toBe('deuter');
    expect(normalizeCbMode('tritan')).toBe('tritan');
    expect(normalizeCbMode('')).toBe('');
    expect(normalizeCbMode('garbage')).toBe('');
    expect(normalizeCbMode(null)).toBe('');
    expect(normalizeCbMode(undefined)).toBe('');
    expect(normalizeCbMode({})).toBe('');
  });

  it('paletteFor returns the palette for a mode and null for Off/unknown', () => {
    expect(paletteFor('deuter')).toBe(CB_PALETTES.deuter);
    expect(paletteFor('protan')).toBe(CB_PALETTES.protan);
    expect(paletteFor('')).toBeNull();
    expect(paletteFor('nope')).toBeNull();
  });

  it('cbTierColor swaps in the palette colour when a mode is active', () => {
    expect(cbTierColor('rare', 'deuter', '#4488ff')).toBe(CB_PALETTES.deuter.rare);
    expect(cbTierColor('unique', 'tritan', '#ff2222')).toBe(CB_PALETTES.tritan.unique);
    expect(cbTierColor('set', 'protan', '#1fd4c4')).toBe(CB_PALETTES.protan.set);
  });

  it('cbTierColor falls back to the base colour when Off', () => {
    expect(cbTierColor('rare', '', '#4488ff')).toBe('#4488ff');
    expect(cbTierColor('rare', 'nope', '#4488ff')).toBe('#4488ff');
  });

  it('cbTierColor falls back to base for a key the palette does not cover', () => {
    expect(cbTierColor('bogus', 'deuter', '#123456')).toBe('#123456');
    expect(cbTierColor(undefined, 'deuter', '#123456')).toBe('#123456');
  });

  it('cbTierKeys are the eight tiers', () => {
    expect(cbTierKeys()).toEqual(['junk', 'normal', 'uncommon', 'rare', 'epic', 'legendary', 'unique', 'set']);
  });
});
