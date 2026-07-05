import { describe, it, expect } from 'vitest';
import { glideVitalFill, latchFillRate } from '../../src/systems/vitalFill.js';

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

describe('latchFillRate', () => {
  it('uses the live rate while recovery is active', () => {
    expect(latchFillRate({ live: 12.5, last: 0, vis: 50, cur: 60 })).toBe(12.5);
    // and refreshes the latch even if a stale value was banked
    expect(latchFillRate({ live: 12.5, last: 999, vis: 50, cur: 60 })).toBe(12.5);
  });

  it('keeps the last rate when recovery stopped but the fill still trails', () => {
    // The earned value has hit its cap (live 0) but the fill hasn't caught up — finish the
    // tail at the recovery pace, not the fast rate-less ease. THIS is the recharge-jump fix.
    expect(latchFillRate({ live: 0, last: 12.5, vis: 97, cur: 100 })).toBe(12.5);
  });

  it('drops the latch once the fill has caught up (settled at the cap)', () => {
    expect(latchFillRate({ live: 0, last: 12.5, vis: 100, cur: 100 })).toBe(0);
  });

  it('drops the latch on a loss (earned value fell below the fill)', () => {
    // A hit dropped cur below the shown fill — no latched rate should linger.
    expect(latchFillRate({ live: 0, last: 12.5, vis: 80, cur: 55 })).toBe(0);
  });

  it('has no latch on the first frame (vis null) or when nothing is recovering', () => {
    expect(latchFillRate({ live: 0, last: 0, vis: null, cur: 40 })).toBe(0);
    expect(latchFillRate({ live: 0, last: 0, vis: 60, cur: 60 })).toBe(0);
  });

  it('closes a recharge tail at a CONSTANT rate — no end-of-fill rush', () => {
    // End-to-end: real value steps up once per 400ms beat while the fill glides every
    // frame; the live rate gates to 0 the instant the real value caps. Latching the last
    // rate must keep the top-of-bar visual speed equal to the steady recharge speed.
    const MX = 100, TICK = 0.4, RATE = 12.5, frameDt = 1 / 60;
    let real = 40, vis = 40, last = RATE, live = RATE, beatAcc = 0;
    const tailSpeeds = [];
    for (let i = 0; i < 60 * 10; i++) {
      beatAcc += frameDt;
      if (beatAcc >= TICK) {
        beatAcc -= TICK;
        if (real < MX) real = Math.min(MX, real + RATE * TICK);
        live = real < MX ? RATE : 0;                    // mirrors the game's rate gate
      }
      const rate = latchFillRate({ live, last, vis, cur: real });
      last = rate;
      const prev = vis;
      vis = glideVitalFill({ vis, cur: real, max: MX, rate, dt: frameDt });
      if (vis > MX * 0.9 && vis < MX - 1e-6) tailSpeeds.push((vis - prev) / frameDt);
      if (real >= MX && vis >= MX - 1e-6) break;
    }
    const moving = tailSpeeds.filter(s => s > 1e-9);
    // Every moving tail frame sits at the steady recharge rate — never the fast ease.
    for (const s of moving) expect(s).toBeCloseTo(RATE, 5);
  });
});
