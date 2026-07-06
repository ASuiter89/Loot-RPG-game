import { describe, it, expect } from 'vitest';
import { CYCLES } from '../../src/data/cycles.js';
import { CYCLE_MODIFIERS } from '../../src/data/cycleModifiers.js';

const BOUNTY_KINDS = new Set(['slay', 'delve', 'clear', 'boss', 'elite', 'gold', 'custom']);
const modIds = new Set(CYCLE_MODIFIERS.map((m) => m.id));

describe('CYCLES registry shape', () => {
  it('is a non-empty ordered array', () => {
    expect(Array.isArray(CYCLES)).toBe(true);
    expect(CYCLES.length).toBeGreaterThanOrEqual(4);
  });

  it('every cycle has unique id, name, parseable window, and a resolvable modifier', () => {
    const ids = new Set();
    for (const c of CYCLES) {
      expect(typeof c.id).toBe('string');
      expect(c.id.length).toBeGreaterThan(0);
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(typeof c.name).toBe('string');
      const start = Date.parse(c.startISO);
      const end = Date.parse(c.endISO);
      expect(Number.isNaN(start)).toBe(false);
      expect(Number.isNaN(end)).toBe(false);
      // A window must be a positive-length interval.
      expect(end).toBeGreaterThan(start);
      // The headline rule must resolve to a real modifier row.
      expect(modIds.has(c.headlineModifierId)).toBe(true);
    }
  });

  it('windows are chronological and non-overlapping (start of N ≥ end of N-1)', () => {
    for (let i = 1; i < CYCLES.length; i++) {
      const prevEnd = Date.parse(CYCLES[i - 1].endISO);
      const curStart = Date.parse(CYCLES[i].startISO);
      expect(curStart).toBeGreaterThanOrEqual(prevEnd);
    }
  });

  it('spans past → future so a nowMs can land live / pre / ended', () => {
    const starts = CYCLES.map((c) => Date.parse(c.startISO));
    const ends = CYCLES.map((c) => Date.parse(c.endISO));
    // At least one window is in the past and one starts in the future relative to a
    // mid-2026 reference the systems tests use.
    const ref = Date.parse('2026-07-06T00:00:00Z');
    expect(Math.min(...ends)).toBeLessThan(ref);          // something has ended
    expect(Math.max(...starts)).toBeGreaterThan(ref);     // something is upcoming
    // And one window straddles the reference (a live season exists).
    expect(CYCLES.some((c) => Date.parse(c.startISO) <= ref && ref < Date.parse(c.endISO))).toBe(true);
  });
});

describe('CYCLES journeys', () => {
  it('each cycle has ~15 milestones with valid kinds, ids, needs and rewards', () => {
    for (const c of CYCLES) {
      expect(Array.isArray(c.journey)).toBe(true);
      expect(c.journey.length).toBeGreaterThanOrEqual(10);
      const stepIds = new Set();
      for (const s of c.journey) {
        expect(typeof s.id).toBe('string');
        expect(stepIds.has(s.id)).toBe(false); // ids unique within a journey
        stepIds.add(s.id);
        expect(BOUNTY_KINDS.has(s.kind)).toBe(true);
        expect(typeof s.name).toBe('string');
        expect(Number.isFinite(s.need)).toBe(true);
        expect(s.need).toBeGreaterThan(0);
        expect(s.reward).toBeTruthy();
        expect(typeof s.reward.type).toBe('string');
        // A custom step must name the totals field it reads.
        if (s.kind === 'custom') expect(typeof s.field).toBe('string');
      }
    }
  });
});

describe('CYCLES rewardTiers', () => {
  it('each cycle has ascending, well-formed placement tiers', () => {
    for (const c of CYCLES) {
      expect(Array.isArray(c.rewardTiers)).toBe(true);
      expect(c.rewardTiers.length).toBeGreaterThan(0);
      let prev = 0;
      for (const t of c.rewardTiers) {
        expect(Number.isFinite(t.rank)).toBe(true);
        expect(t.rank).toBeGreaterThan(prev); // most-prestigious (smallest) first, strictly increasing
        prev = t.rank;
        expect(t.reward).toBeTruthy();
        expect(typeof t.reward.type).toBe('string');
      }
    }
  });
});
