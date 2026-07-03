import { describe, it, expect } from 'vitest';
import { shadeColor, hexA, _parseRGBA } from '../../src/utils/color.js';

describe('shadeColor', () => {
  it('scales channels by the factor and returns rgb()', () => {
    expect(shadeColor('#ffffff', 0.5)).toBe('rgb(128,128,128)');
    expect(shadeColor('#ff0000', 0.5)).toBe('rgb(128,0,0)');
    expect(shadeColor('#102030', 1)).toBe('rgb(16,32,48)');
  });
  it('accepts hex without the leading #', () => {
    expect(shadeColor('00ff00', 0.5)).toBe('rgb(0,128,0)');
  });
  it('passes through non-#rrggbb input unchanged', () => {
    expect(shadeColor('rgb(1,2,3)', 0.5)).toBe('rgb(1,2,3)');
    expect(shadeColor('', 0.5)).toBe('');
    expect(shadeColor(null, 0.5)).toBe(null);
  });
});

describe('hexA', () => {
  it('returns rgba() with the given alpha', () => {
    expect(hexA('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
    expect(hexA('#000000', 1)).toBe('rgba(0,0,0,1)');
    expect(hexA('102030', 0.25)).toBe('rgba(16,32,48,0.25)');
  });
  it('passes through non-hex and falsy input', () => {
    expect(hexA('nope', 0.5)).toBe('nope');
    expect(hexA('', 1)).toBe('');
    expect(hexA(null, 0.5)).toBe(null);
  });
});

describe('_parseRGBA', () => {
  it('parses rgb() and rgba()', () => {
    expect(_parseRGBA('rgb(10,20,30)')).toEqual({ rgb: '10,20,30', a: 1 });
    expect(_parseRGBA('rgba(10, 20, 30, 0.5)')).toEqual({ rgb: '10,20,30', a: 0.5 });
  });
  it('parses #rgb, #rrggbb and #rrggbbaa', () => {
    expect(_parseRGBA('#f00')).toEqual({ rgb: '255,0,0', a: 1 });
    expect(_parseRGBA('#ff0000')).toEqual({ rgb: '255,0,0', a: 1 });
    expect(_parseRGBA('#ff000080')).toEqual({ rgb: '255,0,0', a: 128 / 255 });
  });
  it('trims whitespace on hex input', () => {
    expect(_parseRGBA('  #00ff00 ')).toEqual({ rgb: '0,255,0', a: 1 });
  });
  it('falls back to opaque white on garbage', () => {
    expect(_parseRGBA('not-a-color')).toEqual({ rgb: '255,255,255', a: 1 });
    expect(_parseRGBA('')).toEqual({ rgb: '255,255,255', a: 1 });
  });
});
