import { describe, it, expect } from 'vitest';
import { MUSIC_SECTIONS } from '../../src/data/musicSections.js';
import { bassSemi, voiceChord } from '../../src/systems/musicGroove.js';

const STEPS_PER_BAR = 8;
const BASS_DEGREES = new Set(['r', '8', '5', '5h', '3', 'n1', 'n2', 'na']);
const VOICINGS = new Set(['root', 'inv1', 'inv2', 'open', 'wide']);
// The synth-engine instrument recipes (mVoice in src/legacy/game.js). Every
// timbre's `voice` must name one, or the engine falls back to a default shape.
const VOICES = new Set(['saw', 'sub', 'reese', 'acid', 'sing', 'pluck', 'fm', 'square', 'supersaw', 'warm']);

describe('MUSIC_SECTIONS data validity', () => {
  it('is a non-empty array with Boss kept last', () => {
    expect(Array.isArray(MUSIC_SECTIONS)).toBe(true);
    expect(MUSIC_SECTIONS.length).toBeGreaterThanOrEqual(10);
    expect(MUSIC_SECTIONS[MUSIC_SECTIONS.length - 1].name).toBe('Boss');
  });

  it('every style has a complete, well-typed kit', () => {
    for (const [i, s] of MUSIC_SECTIONS.entries()) {
      const at = `section ${i} (${s.name})`;
      expect(typeof s.name, `${at} name`).toBe('string');
      expect(s.tempo, `${at} tempo`).toBeGreaterThan(0);
      expect(Array.isArray(s.scale), `${at} scale`).toBe(true);
      expect(s.scale.every(n => Number.isFinite(n)), `${at} scale nums`).toBe(true);

      expect(Array.isArray(s.progs) && s.progs.length > 0, `${at} progs`).toBe(true);
      for (const prog of s.progs) {
        expect(Array.isArray(prog) && prog.length > 0, `${at} prog`).toBe(true);
        for (const triad of prog) {
          expect(triad.length, `${at} triad length`).toBe(3);
          expect(triad.every(n => Number.isFinite(n)), `${at} triad nums`).toBe(true);
        }
      }

      for (const role of ['bass', 'pad', 'lead']) {
        const p = s[role];
        expect(typeof p.type, `${at} ${role}.type`).toBe('string');
        expect(VOICES.has(p.voice), `${at} ${role}.voice ${p.voice}`).toBe(true);
        for (const k of ['cutoff', 'q', 'detune', 'vol']) {
          expect(Number.isFinite(p[k]), `${at} ${role}.${k}`).toBe(true);
        }
      }

      for (const k of ['leadDensity', 'arpDensity', 'kickVol', 'kickMidVol', 'hatVol']) {
        expect(Number.isFinite(s[k]), `${at} ${k}`).toBe(true);
      }
    }
  });

  it('every groove has the four 8-step lanes and the scalar knobs', () => {
    for (const s of MUSIC_SECTIONS) {
      const g = s.groove;
      for (const k of ['swing', 'leadOct', 'arpOct', 'arpEvery', 'arpVel', 'chordOct', 'leadLong', 'leadRest']) {
        expect(Number.isFinite(g[k]), `${s.name} groove.${k}`).toBe(true);
      }
      expect(g.arpEvery, `${s.name} arpEvery`).toBeGreaterThan(0);
      for (const lane of ['bassPat', 'chordPat', 'kickPat', 'hatPat']) {
        expect(g[lane].length, `${s.name} ${lane} length`).toBe(STEPS_PER_BAR);
      }
    }
  });

  it('bassPat steps are rests or valid {d,l} moves the resolver understands', () => {
    for (const s of MUSIC_SECTIONS) {
      for (const step of s.groove.bassPat) {
        if (step === null) continue;
        expect(BASS_DEGREES.has(step.d), `${s.name} bass degree ${step.d}`).toBe(true);
        expect(step.l, `${s.name} bass length`).toBeGreaterThan(0);
        if (step.p != null) { expect(step.p).toBeGreaterThan(0); expect(step.p).toBeLessThanOrEqual(1); }
        // ties data → resolver: every degree resolves to a real pitch.
        expect(Number.isFinite(bassSemi(step.d, s.progs[0][0], s.progs[0][1]))).toBe(true);
      }
    }
  });

  it('chordPat steps are rests or valid {l,voi} stabs the resolver understands', () => {
    for (const s of MUSIC_SECTIONS) {
      for (const step of s.groove.chordPat) {
        if (step === null) continue;
        expect(step.l, `${s.name} chord length`).toBeGreaterThan(0);
        if (step.voi != null) expect(VOICINGS.has(step.voi), `${s.name} voi ${step.voi}`).toBe(true);
        if (step.p != null) { expect(step.p).toBeGreaterThan(0); expect(step.p).toBeLessThanOrEqual(1); }
        const tones = voiceChord(s.progs[0][0], step.voi);
        expect(tones).toHaveLength(3);
        expect(tones.every(n => Number.isFinite(n)), `${s.name} voiced tones`).toBe(true);
      }
    }
  });

  it('every style is uniquely different — no shared name, bass groove, or comp groove', () => {
    const names = MUSIC_SECTIONS.map(s => s.name);
    expect(new Set(names).size, 'unique names').toBe(names.length);
    // A style's rhythmic identity is its bass + chord lanes; require every style's
    // to be distinct from every other's so none feel like a re-skin of another.
    const bassSigs = MUSIC_SECTIONS.map(s => JSON.stringify(s.groove.bassPat));
    const chordSigs = MUSIC_SECTIONS.map(s => JSON.stringify(s.groove.chordPat));
    expect(new Set(bassSigs).size, 'unique basslines').toBe(bassSigs.length);
    expect(new Set(chordSigs).size, 'unique chord comps').toBe(chordSigs.length);
  });

  it('at least one non-downbeat bass hit per style — no plain "one root per bar" plod', () => {
    for (const s of MUSIC_SECTIONS) {
      const hits = s.groove.bassPat.filter(Boolean).length;
      expect(hits, `${s.name} bass hits`).toBeGreaterThan(1);
    }
  });
});
