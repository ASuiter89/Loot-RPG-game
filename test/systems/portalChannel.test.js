import { describe, it, expect } from 'vitest';
import { portalChannelStep } from '../../src/systems/portalChannel.js';

// Pure per-tick resolution of a channeling town portal. The game loop feeds in the
// channel state + what happened to the hero during the foe/hazard phase and reads
// back what to do. These tests pin the break rule that matters: a LANDED blow
// shatters a half-formed portal even when a shield soaked all of it (no HP loss).

const TICK = 0.5;   // stand-in world-tick length; the real value comes from the caller

describe('portalChannelStep', () => {
  it('does nothing when no channel is running', () => {
    expect(portalChannelStep({ charge: 0, hpBefore: 100, hpNow: 100, struck: false, tickSecs: TICK }))
      .toEqual({ action: 'idle', charge: 0 });
    expect(portalChannelStep({ charge: -1, hpBefore: 100, hpNow: 100, struck: false, tickSecs: TICK }).action)
      .toBe('idle');
  });

  it('counts the channel down by one tick while it is left clean', () => {
    const res = portalChannelStep({ charge: 3, hpBefore: 100, hpNow: 100, struck: false, tickSecs: TICK });
    expect(res.action).toBe('tick');
    expect(res.charge).toBeCloseTo(2.5);
  });

  it('opens the portal on the tick the channel runs out', () => {
    expect(portalChannelStep({ charge: TICK, hpBefore: 100, hpNow: 100, struck: false, tickSecs: TICK }).action)
      .toBe('open');
    expect(portalChannelStep({ charge: 0.3, hpBefore: 100, hpNow: 100, struck: false, tickSecs: TICK }).action)
      .toBe('open');
  });

  it('shatters when a blow costs HP', () => {
    const res = portalChannelStep({ charge: 3, hpBefore: 100, hpNow: 88, struck: false, tickSecs: TICK });
    expect(res.action).toBe('shatter');
    expect(res.charge).toBe(0);
  });

  it('shatters on a landed blow a shield fully soaked (no HP lost)', () => {
    // The whole point of this change: HP is untouched (a Spirit Veil / barrier ate
    // the hit), but a blow still LANDED — the portal must collapse.
    const res = portalChannelStep({ charge: 3, hpBefore: 100, hpNow: 100, struck: true, tickSecs: TICK });
    expect(res.action).toBe('shatter');
    expect(res.charge).toBe(0);
  });

  it('a struck blow overrides an otherwise-clean completing tick', () => {
    // Even on the tick that would finish the channel, a landed blow shatters it.
    expect(portalChannelStep({ charge: TICK, hpBefore: 100, hpNow: 100, struck: true, tickSecs: TICK }).action)
      .toBe('shatter');
  });

  it('a killing blow yields death, not a shatter (death takes over)', () => {
    const res = portalChannelStep({ charge: 3, hpBefore: 40, hpNow: 0, struck: true, tickSecs: TICK });
    expect(res.action).toBe('death');
    expect(res.charge).toBe(0);
    // Negative HP (overkill) is death too.
    expect(portalChannelStep({ charge: 3, hpBefore: 40, hpNow: -5, struck: false, tickSecs: TICK }).action)
      .toBe('death');
  });
});
