import { describe, it, expect } from 'vitest';
import { bassSemi, voiceChord, voiceSpread } from '../../src/systems/musicGroove.js';

// Am triad [root, third, fifth] and the F it resolves into (root 8), in semitones
// from A2 — the same absolute-offset convention the section data uses.
const Am = [0, 3, 7];
const F  = [8, 12, 15];

describe('bassSemi — degree → semitone offset from A2', () => {
  it('roots and chord tones sit an octave below the chord', () => {
    expect(bassSemi('r', Am, F)).toBe(-12);   // low root
    expect(bassSemi('8', Am, F)).toBe(0);      // root up an octave
    expect(bassSemi('5', Am, F)).toBe(-5);     // fifth (7) − 12
    expect(bassSemi('5h', Am, F)).toBe(7);     // fifth up an octave
    expect(bassSemi('3', Am, F)).toBe(-9);     // third (3) − 12
  });

  it('approach degrees walk chromatically toward the NEXT chord root', () => {
    // next root F = 8, in the bass octave that is 8 − 12 = −4.
    expect(bassSemi('n1', Am, F)).toBe(-6);    // whole step below −4
    expect(bassSemi('n2', Am, F)).toBe(-5);    // half step below (leading tone)
    expect(bassSemi('na', Am, F)).toBe(-3);    // half step above (descending lead-in)
  });

  it('falls back to the low root for an unknown degree', () => {
    expect(bassSemi('???', Am, F)).toBe(-12);
    expect(bassSemi(undefined, Am, F)).toBe(-12);
  });

  it('approach degrees fall back to the current chord when nextChord is missing', () => {
    // nextRoot defaults to root − 12 = −12, so n2 = −13, na = −11.
    expect(bassSemi('n1', Am)).toBe(-14);
    expect(bassSemi('n2', Am, null)).toBe(-13);
    expect(bassSemi('na', Am, undefined)).toBe(-11);
  });
});

describe('voiceChord — triad re-voicings', () => {
  it('produces the documented voicings', () => {
    expect(voiceChord(Am, 'root')).toEqual([0, 3, 7]);
    expect(voiceChord(Am, 'inv1')).toEqual([3, 7, 12]);   // third in the bass
    expect(voiceChord(Am, 'inv2')).toEqual([7, 12, 15]);  // fifth in the bass
    expect(voiceChord(Am, 'open')).toEqual([0, 7, 15]);   // third up an octave
    expect(voiceChord(Am, 'wide')).toEqual([-12, 3, 7]);  // root dropped an octave
  });

  it('falls back to close root position for an unknown/absent voicing', () => {
    expect(voiceChord(Am, 'nonsense')).toEqual([0, 3, 7]);
    expect(voiceChord(Am)).toEqual([0, 3, 7]);
  });

  it('always returns exactly three tones', () => {
    for (const v of ['root', 'inv1', 'inv2', 'open', 'wide', undefined]) {
      expect(voiceChord(Am, v)).toHaveLength(3);
    }
  });
});

describe('voiceSpread — detuned super-saw / reese oscillator cluster', () => {
  it('a single voice sits dead on pitch', () => {
    expect(voiceSpread(1, 20)).toEqual([0]);
    expect(voiceSpread(0, 20)).toEqual([0]);
  });

  it('spreads n voices evenly across the full ±cents range', () => {
    expect(voiceSpread(2, 10)).toEqual([-10, 10]);
    expect(voiceSpread(3, 12)).toEqual([-12, 0, 12]);
    expect(voiceSpread(5, 16)).toEqual([-16, -8, 0, 8, 16]);
  });

  it('stays centred on the true pitch (offsets sum to ~0)', () => {
    for (const n of [2, 3, 4, 5, 7]) {
      const sum = voiceSpread(n, 18).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum)).toBeLessThan(1e-9);
      expect(voiceSpread(n, 18)).toHaveLength(n);
    }
  });
});
