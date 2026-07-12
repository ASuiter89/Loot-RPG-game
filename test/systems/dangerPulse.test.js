import { describe, it, expect } from 'vitest';
import {
  DANGER_HP_FRAC, dangerLevel, beatIntervalMs, heartbeatDue,
} from '../../src/systems/dangerPulse.js';

// Low-HP heartbeat: HP fraction → danger intensity → a quickening thump cadence.
// These lock the contract the edge relies on: silence above the threshold and when
// dead, a monotonic ramp toward death, a beat that speeds up with danger, and a
// prompt thump the moment you drop into the red.

// The heartbeat must engage exactly where the danger halo does.
const THRESH = DANGER_HP_FRAC * 100;

describe('dangerLevel', () => {
  it('is silent at or above the danger threshold', () => {
    expect(dangerLevel(100, 100)).toBe(0);
    expect(dangerLevel(THRESH, 100)).toBe(0);            // exactly at the threshold
    expect(dangerLevel(THRESH + 1, 100)).toBe(0);
  });

  it('ramps 0→1 as HP falls from the threshold to 0', () => {
    // Just under the threshold → barely any danger.
    expect(dangerLevel(THRESH - 1, 100)).toBeGreaterThan(0);
    expect(dangerLevel(THRESH - 1, 100)).toBeLessThan(0.1);
    // Half of the danger band → about half danger.
    expect(dangerLevel(THRESH / 2, 100)).toBeCloseTo(0.5, 5);
    // A sliver of HP → near maximum danger.
    expect(dangerLevel(1, 100)).toBeGreaterThan(0.9);
  });

  it('is monotonic within the live band: lower HP is never less dangerous', () => {
    // Only across live HP (1..threshold); hp 0 is the dead special-case that resets
    // to 0 because the death flow owns the screen.
    let prev = -1;
    for (let hp = THRESH; hp >= 1; hp--) {
      const d = dangerLevel(hp, 100);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  it('returns 0 when dead or HP/max is missing (death owns the screen)', () => {
    expect(dangerLevel(0, 100)).toBe(0);
    expect(dangerLevel(-10, 100)).toBe(0);
    expect(dangerLevel(50, 0)).toBe(0);
    expect(dangerLevel(undefined, 100)).toBe(0);
    expect(dangerLevel(50, undefined)).toBe(0);
    expect(dangerLevel(NaN, NaN)).toBe(0);
  });

  it('stays within [0,1] for any positive HP under the threshold', () => {
    expect(dangerLevel(0.0001, 100)).toBeLessThanOrEqual(1);
    expect(dangerLevel(0.0001, 100)).toBeGreaterThan(0);
  });
});

describe('beatIntervalMs', () => {
  it('shortens as danger rises (heart races near death)', () => {
    const calm = beatIntervalMs(0);
    const panic = beatIntervalMs(1);
    expect(calm).toBeGreaterThan(panic);
    expect(beatIntervalMs(0.5)).toBeCloseTo((calm + panic) / 2, 5);
  });

  it('clamps danger outside 0..1', () => {
    expect(beatIntervalMs(-5)).toBe(beatIntervalMs(0));
    expect(beatIntervalMs(5)).toBe(beatIntervalMs(1));
  });
});

describe('heartbeatDue', () => {
  it('never fires without danger', () => {
    expect(heartbeatDue(0, 10_000, 0)).toBe(false);
    expect(heartbeatDue(-1, 10_000, 0)).toBe(false);
  });

  it('fires immediately on entering danger (large gap since last beat)', () => {
    expect(heartbeatDue(0.5, 100_000, 0)).toBe(true);
  });

  it('waits a full beat interval between thumps', () => {
    const d = 0.5;
    const period = beatIntervalMs(d);
    const last = 5000;
    expect(heartbeatDue(d, last + period - 1, last)).toBe(false);   // not yet
    expect(heartbeatDue(d, last + period, last)).toBe(true);        // due
  });

  it('races faster at higher danger', () => {
    const last = 0;
    const t = 500; // ms since last beat
    // At high danger the interval is shorter, so 500ms is enough to be due...
    expect(heartbeatDue(1, t, last)).toBe(true);
    // ...but at low danger the interval is longer, so the same 500ms is not.
    expect(heartbeatDue(0.01, t, last)).toBe(false);
  });

  it('treats a missing lastBeatAt as long ago', () => {
    expect(heartbeatDue(0.5, 1000, undefined)).toBe(true);
  });

  it('models a run of beats: each thump is one danger-scaled interval apart', () => {
    const d = 0.8;
    const period = beatIntervalMs(d);
    let last = 0, now = 0, beats = 0;
    // Advance a fine clock; count how many thumps land over ~5 intervals.
    for (let i = 0; i < 6000; i += 10) {
      now = i;
      if (heartbeatDue(d, now, last)) { beats++; last = now; }
    }
    // ~ (6000 / period) beats, give or take the first immediate one.
    expect(beats).toBeGreaterThanOrEqual(Math.floor(6000 / period));
    expect(beats).toBeLessThanOrEqual(Math.floor(6000 / period) + 2);
  });
});
