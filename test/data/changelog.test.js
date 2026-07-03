import { describe, it, expect } from 'vitest';
import { CHANGELOG } from '../../src/data/changelog.js';

describe('CHANGELOG data validity', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(CHANGELOG)).toBe(true);
    expect(CHANGELOG.length).toBeGreaterThan(10);
  });

  it('every entry has the { date, size, v, by, notes[] } shape', () => {
    for (const [i, e] of CHANGELOG.entries()) {
      expect(typeof e.date, `entry ${i} date`).toBe('string');
      expect(e.date, `entry ${i} date format`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof e.size, `entry ${i} size`).toBe('string');
      expect(typeof e.v, `entry ${i} v`).toBe('string');
      expect(typeof e.by, `entry ${i} by`).toBe('string');
      expect(Array.isArray(e.notes), `entry ${i} notes`).toBe(true);
      expect(e.notes.length, `entry ${i} notes non-empty`).toBeGreaterThan(0);
      for (const n of e.notes) expect(typeof n).toBe('string');
    }
  });

  it('is ordered newest-first', () => {
    expect(CHANGELOG[0].date >= CHANGELOG[CHANGELOG.length - 1].date).toBe(true);
  });

  it('never references other games (project changelog rule)', () => {
    // CLAUDE.md: player-facing copy must stand on its own, not lean on another
    // title for meaning. Guard the most likely slips.
    const forbidden = /\b(diablo|golden sun|roguelike|rogue-like)\b/i;
    const offenders = [];
    for (const e of CHANGELOG) {
      for (const n of e.notes) if (forbidden.test(n)) offenders.push(`${e.v}: ${n}`);
      if (forbidden.test(e.v)) offenders.push(e.v);
    }
    expect(offenders, `changelog references another game:\n${offenders.join('\n')}`).toEqual([]);
  });
});
