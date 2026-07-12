import { describe, it, expect } from 'vitest';
import { rollTo } from '../../src/systems/counterRoll.js';

// Rolling HUD counters: shown value eases toward the target and always lands on it.
// These lock the contract the HUD relies on: no motion on a zero dt, a monotonic
// approach that never overshoots, an exact landing, frame-rate independence, and a
// prompt (non-crawling) finish for small gaps in both directions.

describe('rollTo', () => {
  it('does not move on a zero or negative dt', () => {
    expect(rollTo(10, 100, 0)).toBe(10);
    expect(rollTo(10, 100, -0.5)).toBe(10);
  });

  it('is a no-op when already at the target', () => {
    expect(rollTo(100, 100, 0.016)).toBe(100);
  });

  it('moves toward the target without overshooting (counting up)', () => {
    const next = rollTo(0, 100, 0.016);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(100);
  });

  it('moves toward the target when counting down (a spend)', () => {
    const next = rollTo(100, 40, 0.016);
    expect(next).toBeLessThan(100);
    expect(next).toBeGreaterThan(40);
  });

  it('lands exactly on the target when a step would reach or overshoot it', () => {
    // A generous rate + long frame would blow past — must clamp to the target.
    expect(rollTo(99, 100, 5)).toBe(100);
    expect(rollTo(2, 100, 100)).toBe(100);
    expect(rollTo(100, 0, 100)).toBe(0);
  });

  it('converges to the target over time and stops there', () => {
    let v = 0;
    for (let i = 0; i < 600; i++) v = rollTo(v, 12345, 1 / 60);
    expect(v).toBe(12345);
    // Once landed it stays put.
    expect(rollTo(v, 12345, 1 / 60)).toBe(12345);
  });

  it('never overshoots across a whole animation regardless of frame size', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      let v = 0;
      for (let i = 0; i < 1000 && v !== 500; i++) {
        const prev = v;
        v = rollTo(v, 500, dt);
        expect(v).toBeGreaterThanOrEqual(prev); // monotonic up
        expect(v).toBeLessThanOrEqual(500);     // never past the target
      }
      expect(v).toBe(500);
    }
  });

  it('closes a tiny gap promptly instead of crawling (the minPerSec floor)', () => {
    // A 1-unit gap must finish within a reasonable number of frames, not crawl.
    let v = 999, frames = 0;
    while (v !== 1000 && frames < 60) { v = rollTo(v, 1000, 1 / 60); frames++; }
    expect(v).toBe(1000);
    expect(frames).toBeLessThan(30); // well under half a second
  });

  it('takes bigger early steps for a bigger gap (ease-out shape)', () => {
    const smallGap = rollTo(0, 10, 1 / 60) - 0;
    const bigGap = rollTo(0, 10000, 1 / 60) - 0;
    expect(bigGap).toBeGreaterThan(smallGap);
  });

  it('is frame-rate independent: one big frame ≈ many small frames to the same time', () => {
    // Advance 0.2s as one step vs. twelve ~16.6ms steps — should land close.
    const oneStep = rollTo(0, 1000, 0.2);
    let many = 0;
    for (let t = 0; t < 0.2 - 1e-9; t += 0.2 / 12) many = rollTo(many, 1000, 0.2 / 12);
    expect(many).toBeCloseTo(oneStep, 0);
  });

  it('honors a custom rate (higher rate closes more of the gap per frame)', () => {
    const slow = rollTo(0, 100, 1 / 60, { rate: 4 });
    const fast = rollTo(0, 100, 1 / 60, { rate: 16 });
    expect(fast).toBeGreaterThan(slow);
  });
});
