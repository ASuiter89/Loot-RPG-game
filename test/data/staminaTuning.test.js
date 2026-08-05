import { describe, it, expect } from 'vitest';
import { STAMINA } from '../../src/data/staminaTuning.js';

// The stamina dials are only meaningful as a RATIO — a drain, a refill and a dash
// cost read against one pool. Any one of them edited alone can quietly wreck the
// feel (sprint that outlasts a floor, a dash you can spam, a pool that never comes
// back). These pin the shape of the economy rather than the literal numbers, so a
// future retune is free to move them as long as sprint stays the sustainable
// traversal tool and dash stays the scarce burst.

const sprintWindow = () => STAMINA.max / STAMINA.sprintDrain;
const refillTime = () => STAMINA.regenDelay + STAMINA.max / STAMINA.regenPerSec;

describe('STAMINA dials', () => {
  it('are all positive finite numbers', () => {
    for (const [k, v] of Object.entries(STAMINA)) {
      expect(typeof v, `${k} is not a number`).toBe('number');
      expect(Number.isFinite(v), `${k} is not finite`).toBe(true);
      expect(v, `${k} must be positive`).toBeGreaterThan(0);
    }
  });
});

describe('sprint — the sustainable traversal tool', () => {
  it('runs for at least 4s from a full baseline pool', () => {
    // Below ~4s a sprint can't cross a room, and Shift reads as a cooldown.
    expect(sprintWindow()).toBeGreaterThanOrEqual(4);
  });

  it('refills faster than it drains, so recovery is shorter than the sprint', () => {
    expect(STAMINA.regenPerSec).toBeGreaterThan(STAMINA.sprintDrain);
    expect(refillTime()).toBeLessThan(sprintWindow());
  });

  it('leaves sprint available over half the time when cycled continuously', () => {
    const uptime = sprintWindow() / (sprintWindow() + refillTime());
    expect(uptime).toBeGreaterThan(0.5);
  });

  it('still costs something — an infinite sprint is not the goal', () => {
    // A pool that outlasts a whole floor traversal makes the stat meaningless.
    expect(sprintWindow()).toBeLessThan(12);
  });
});

describe('dash — the scarce burst', () => {
  it('costs far more than a second of sprinting', () => {
    expect(STAMINA.dashCost).toBeGreaterThan(STAMINA.sprintDrain * 2);
  });

  it('allows exactly two dashes from a full baseline pool', () => {
    expect(Math.floor(STAMINA.max / STAMINA.dashCost)).toBe(2);
  });

  it('cannot be chained faster than ~2s once the pool is spent', () => {
    // Guards the trade that pays for the friendlier sprint: the quicker refill must
    // not turn dash into a travel move.
    expect(STAMINA.regenDelay + STAMINA.dashCost / STAMINA.regenPerSec).toBeGreaterThan(1.5);
  });
});

describe('the exertion pause', () => {
  it('is short enough to feel like a breath, not a cooldown', () => {
    expect(STAMINA.regenDelay).toBeGreaterThan(0);
    expect(STAMINA.regenDelay).toBeLessThanOrEqual(1);
  });
});
