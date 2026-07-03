import { describe, it, expect } from 'vitest';
import { glideVitalFill } from '../../src/systems/vitalFill.js';

// The fill glides toward the hero's current HP/MP every animation frame. These lock the
// contract that makes over-time recovery climb smoothly: a linear slope at the live
// recovery rate (no per-beat step), instant snaps on losses and bursts, and a fill that
// never runs ahead of the earned value.

describe('glideVitalFill', () => {
  const MAX = 100;

  it('snaps to the current value on the first frame (vis null)', () => {
    expect(glideVitalFill({ vis: null, cur: 40, max: MAX, rate: 5, dt: 0.016 })).toBe(40);
  });

  it('returns 0 for a missing / zero bar', () => {
    expect(glideVitalFill({ vis: null, cur: 40, max: 0, rate: 5, dt: 0.016 })).toBe(0);
    expect(glideVitalFill({ vis: 10, cur: 40, max: -1, rate: 5, dt: 0.016 })).toBe(0);
  });

  it('snaps DOWN instantly when current drops below the fill (a hit / spend)', () => {
    // Fill was at 80, hero takes damage to 55 → fill jumps straight to 55, no easing.
    expect(glideVitalFill({ vis: 80, cur: 55, max: MAX, rate: 0, dt: 0.016 })).toBe(55);
    // Even mid-recovery, a loss wins.
    expect(glideVitalFill({ vis: 80, cur: 55, max: MAX, rate: 20, dt: 0.5 })).toBe(55);
  });

  it('snaps UP instantly on a big instant gain (active heal / refill / load)', () => {
    // A jump of >30% of max in one frame is a burst, not a trickle → snap to it.
    expect(glideVitalFill({ vis: 20, cur: 90, max: MAX, rate: 0, dt: 0.016, snapFrac: 0.3 })).toBe(90);
  });

  it('glides UP at the live recovery rate — a steady linear slope, no plateau', () => {
    // rate 20/s, one 16ms frame → +0.32, not a snap and not a stall.
    const next = glideVitalFill({ vis: 50, cur: 60, max: MAX, rate: 20, dt: 0.016 });
    expect(next).toBeCloseTo(50.32, 5);
    // The step is exactly rate*dt while there's headroom to the earned value.
    const next2 = glideVitalFill({ vis: 50, cur: 60, max: MAX, rate: 20, dt: 0.1 });
    expect(next2).toBeCloseTo(52, 5);
  });

  it('keeps moving across a whole world beat instead of catching up then waiting', () => {
    // Model a 400ms beat: cur (earned) steps up by rate*beat each beat; the fill glides
    // at rate. It should rise every frame and land on cur right as the beat ends — never
    // reaching cur early and plateauing (the old choppy behaviour).
    const rate = 20, beat = 0.4, frameDt = 1 / 60;
    let vis = 50;
    const cur = 50 + rate * beat; // this beat's earned target (58)
    let frames = 0, plateauFrames = 0;
    for (let t = 0; t < beat - 1e-9; t += frameDt) {
      const prev = vis;
      vis = glideVitalFill({ vis, cur, max: MAX, rate, dt: frameDt });
      frames++;
      if (vis - prev < 1e-6) plateauFrames++;
    }
    expect(plateauFrames).toBe(0);        // it moved on every single frame
    expect(vis).toBeCloseTo(cur, 1);      // and arrived at the beat's value by beat's end
    expect(frames).toBeGreaterThan(20);
  });

  it('never leads the earned value (clamps at cur)', () => {
    // A generous rate / long frame would overshoot — it must clamp to cur, not exceed it.
    expect(glideVitalFill({ vis: 59, cur: 60, max: MAX, rate: 1000, dt: 1 })).toBe(60);
  });

  it('never exceeds max', () => {
    expect(glideVitalFill({ vis: 99, cur: 500, max: MAX, rate: 1000, dt: 1 })).toBe(MAX);
  });

  it('eases a small instant gain that carries no rate (rate 0)', () => {
    // No live rate, small gain (<snapFrac) → exponential ease toward cur, moving up but
    // not snapping the whole way in one frame.
    const next = glideVitalFill({ vis: 50, cur: 60, max: MAX, rate: 0, dt: 0.016, tau: 0.14 });
    expect(next).toBeGreaterThan(50);
    expect(next).toBeLessThan(60);
    // A longer frame closes more of the gap (frame-rate independent ease).
    const far = glideVitalFill({ vis: 50, cur: 60, max: MAX, rate: 0, dt: 1, tau: 0.14 });
    expect(far).toBeCloseTo(60, 1);
  });

  it('is a no-op when already at the current value', () => {
    expect(glideVitalFill({ vis: 60, cur: 60, max: MAX, rate: 20, dt: 0.016 })).toBe(60);
  });

  it('does not move backwards on a zero dt frame', () => {
    expect(glideVitalFill({ vis: 55, cur: 60, max: MAX, rate: 20, dt: 0 })).toBe(55);
  });

  it('treats a negative rate as no recovery (no crash, eases instead)', () => {
    const next = glideVitalFill({ vis: 50, cur: 60, max: MAX, rate: -5, dt: 0.016 });
    expect(next).toBeGreaterThanOrEqual(50);
    expect(next).toBeLessThanOrEqual(60);
  });
});
