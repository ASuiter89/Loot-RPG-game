import { describe, it, expect } from 'vitest';
import { splitPlayTick } from '../../src/systems/playtime.js';

describe('splitPlayTick', () => {
  it('bills both counters for an active, visible tick', () => {
    expect(splitPlayTick({ dtMs: 1000, hidden: false, active: true }))
      .toEqual({ wallMs: 1000, activeMs: 1000 });
  });

  it('bills wall-clock but NOT active while visible-but-idle (no recent input)', () => {
    // The whole point of wall-clock billing: foreground time counts toward the lifetime
    // total even when no keys are pressed, while the conflict signal (activeMs) does not.
    expect(splitPlayTick({ dtMs: 1000, hidden: false, active: false }))
      .toEqual({ wallMs: 1000, activeMs: 0 });
  });

  it('bills nothing when the tab is hidden, regardless of the active flag', () => {
    expect(splitPlayTick({ dtMs: 1000, hidden: true, active: false }))
      .toEqual({ wallMs: 0, activeMs: 0 });
    expect(splitPlayTick({ dtMs: 1000, hidden: true, active: true }))
      .toEqual({ wallMs: 0, activeMs: 0 });
  });

  it('treats a negative delta (clock moved back) as zero', () => {
    expect(splitPlayTick({ dtMs: -5000, hidden: false, active: true }))
      .toEqual({ wallMs: 0, activeMs: 0 });
  });

  it('treats a zero delta as zero', () => {
    expect(splitPlayTick({ dtMs: 0, hidden: false, active: true }))
      .toEqual({ wallMs: 0, activeMs: 0 });
  });

  it('clamps an oversized delta (throttle/sleep) to a single nominal tick', () => {
    expect(splitPlayTick({ dtMs: 60000, hidden: false, active: true }))
      .toEqual({ wallMs: 1000, activeMs: 1000 });
    // idle-but-visible during the throttle still only bills the nominal wall tick
    expect(splitPlayTick({ dtMs: 60000, hidden: false, active: false }))
      .toEqual({ wallMs: 1000, activeMs: 0 });
  });

  it('does not clamp a delta exactly at the max-tick boundary', () => {
    expect(splitPlayTick({ dtMs: 5000, hidden: false, active: true }))
      .toEqual({ wallMs: 5000, activeMs: 5000 });
  });

  it('honours custom maxTickMs / nominalMs', () => {
    expect(splitPlayTick({ dtMs: 3000, hidden: false, active: true, maxTickMs: 2000, nominalMs: 500 }))
      .toEqual({ wallMs: 500, activeMs: 500 });
    expect(splitPlayTick({ dtMs: 1500, hidden: false, active: true, maxTickMs: 2000, nominalMs: 500 }))
      .toEqual({ wallMs: 1500, activeMs: 1500 });
  });
});
