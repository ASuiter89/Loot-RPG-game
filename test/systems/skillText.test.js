import { describe, it, expect } from 'vitest';
import { stripDamageClause } from '../../src/systems/skillText.js';

describe('stripDamageClause', () => {
  it('drops a prepositional "for {dmg}" clause, keeping the trailing action', () => {
    expect(stripDamageClause('Swing wide for {dmg}, striking all foes in front of you.'))
      .toBe('Swing wide, striking all foes in front of you.');
    expect(stripDamageClause('Slam with your shield for {dmg}, stunning the foe and gaining a brief guard.'))
      .toBe('Slam with your shield, stunning the foe and gaining a brief guard.');
    expect(stripDamageClause('Hurl a weapon at a distant foe for {dmg} with deadly precision.'))
      .toBe('Hurl a weapon at a distant foe with deadly precision.');
    expect(stripDamageClause('A frenzy of strikes for {dmg}, hitting twice and stealing heavy life.'))
      .toBe('A frenzy of strikes, hitting twice and stealing heavy life.');
  });

  it('drops an "of {dmg}" clause', () => {
    expect(stripDamageClause('A final killing blow of {dmg} that executes wounded foes.'))
      .toBe('A final killing blow that executes wounded foes.');
  });

  it('drops a predicate "deals {dmg}, <verb>" clause, keeping the subject clause', () => {
    expect(stripDamageClause('A bleeding strike that deals {dmg}, poisons the target and steals life.'))
      .toBe('A bleeding strike that poisons the target and steals life.');
  });

  it('drops "deals {dmg} and <verb>", collapsing the joiner', () => {
    expect(stripDamageClause('A heavy guaranteed-crit blow that deals {dmg} and stuns the target.'))
      .toBe('A heavy guaranteed-crit blow that stuns the target.');
  });

  it('drops "that deals {dmg}, <-ing>", leaving the participial phrase', () => {
    expect(stripDamageClause('A brutal strike that deals {dmg}, hitting harder against wounded foes.'))
      .toBe('A brutal strike hitting harder against wounded foes.');
  });

  it('drops "dealing {dmg} that…", keeping the relative clause', () => {
    expect(stripDamageClause('A wide cleave dealing {dmg} that leaves struck foes vulnerable.'))
      .toBe('A wide cleave that leaves struck foes vulnerable.');
  });

  it('drops "dealing {dmg}," but keeps the following comma clause', () => {
    expect(stripDamageClause('A vampiric strike dealing {dmg}, healing you for a share of it.'))
      .toBe('A vampiric strike, healing you for a share of it.');
    expect(stripDamageClause('Smash the ground for a shockwave dealing {dmg}, stunning nearby foes.'))
      .toBe('Smash the ground for a shockwave, stunning nearby foes.');
  });

  it('drops an infinitive "to deal {dmg}" clause', () => {
    expect(stripDamageClause('A penetrating long-range shot that ignores armor to deal {dmg}.'))
      .toBe('A penetrating long-range shot that ignores armor.');
  });

  it('falls back to the bare word "damage" for an unrecognised frame', () => {
    // A novel grammar the specific rules do not cover must never leave a raw
    // token or dangling punctuation — it degrades to grammatical prose instead.
    expect(stripDamageClause('It unleashes {dmg} upon the wicked.'))
      .toBe('It unleashes damage upon the wicked.');
  });

  it('never leaves a raw {dmg} token or doubled spaces', () => {
    const samples = [
      'Swing wide for {dmg}, striking all foes in front of you.',
      'A bleeding strike that deals {dmg}, poisons the target and steals life.',
      'A wide cleave dealing {dmg} that leaves struck foes vulnerable.',
      'A final killing blow of {dmg} that executes wounded foes.',
      'A penetrating long-range shot that ignores armor to deal {dmg}.',
      'Weird {dmg} phrasing with no connector at all.',
    ];
    for (const s of samples) {
      const out = stripDamageClause(s);
      expect(out).not.toMatch(/\{dmg\}/);
      expect(out).not.toMatch(/\s{2,}/);
      expect(out).not.toMatch(/\s[,.]/);
    }
  });

  it('is idempotent and leaves damage-free text untouched', () => {
    const plain = 'Erupt with frost, freezing nearby foes.';
    expect(stripDamageClause(plain)).toBe(plain);
    const once = stripDamageClause('Swing wide for {dmg}, striking all foes in front of you.');
    expect(stripDamageClause(once)).toBe(once);
  });

  it('handles empty / missing input', () => {
    expect(stripDamageClause('')).toBe('');
    expect(stripDamageClause(undefined)).toBe('');
    expect(stripDamageClause(null)).toBe('');
  });
});
