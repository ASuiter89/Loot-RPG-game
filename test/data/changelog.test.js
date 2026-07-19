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

  it('credits a human, never the tool', () => {
    // `by` records the maintainer who DIRECTED the change (Jeff Louie / Andrew
    // Suiter), never "Claude" — an entry credited to the tool badges as the wrong
    // author (the creator filter buckets every non-JL name into AS). See
    // src/data/contributors.js and src/systems/credit.js.
    const tool = CHANGELOG.filter(e => /\bclaude\b/i.test(e.by));
    expect(
      tool.map(e => `${e.date}  ${e.v}`),
      'changelog entries credited to the tool instead of a human',
    ).toEqual([]);
  });

  it('is ordered newest-first', () => {
    expect(CHANGELOG[0].date >= CHANGELOG[CHANGELOG.length - 1].date).toBe(true);
  });

  it('has no entry dated in the future (Pacific day, not UTC)', () => {
    // CLAUDE.md: entries are dated by the Pacific (America/Los_Angeles) calendar
    // day they ship. The build clock is usually UTC, so an evening change stamped
    // with the UTC "today" lands a day ahead — the Version History then groups it
    // under tomorrow. This guard makes that recurrence fail CI instead of relying
    // on the author remembering to convert. `en-CA` formats as YYYY-MM-DD, and the
    // explicit timeZone makes the check independent of where the test runs.
    const pacificToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const future = CHANGELOG.filter(e => e.date > pacificToday);
    expect(
      future,
      `changelog entries dated after the Pacific day ${pacificToday} (UTC-day drift?):\n`
        + future.map(e => `${e.date}  ${e.v}`).join('\n'),
    ).toEqual([]);
  });

  it('keeps notes terse — no rambling paragraph as a single note', () => {
    // CLAUDE.md: patch notes are skimmed, not read. A single note should be a
    // glanceable fragment, not a multi-sentence essay. This is a coarse backstop
    // (dense reference enumerations legitimately run long); the review rule drives
    // the real ~90-char target. Anything past this ceiling is prose that should be
    // split into separate bullets or cut.
    const MAX = 300;
    const offenders = [];
    for (const e of CHANGELOG) {
      for (const n of e.notes) if (n.length > MAX) offenders.push(`${n.length} chars — ${e.v}: ${n.slice(0, 60)}…`);
    }
    expect(offenders, `notes over ${MAX} chars (split into shorter bullets):\n${offenders.join('\n')}`).toEqual([]);
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
