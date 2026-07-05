import { describe, it, expect } from 'vitest';
import { equipSwapDelta } from '../../src/systems/gearCompare.js';

describe('equipSwapDelta', () => {
  it('is the raw power gain over the slot occupant', () => {
    expect(equipSwapDelta({ itemPower: 100, occupantPower: 70 })).toBe(30);
    expect(equipSwapDelta({ itemPower: 60, occupantPower: 90 })).toBe(-30);
  });

  it('is the whole item power against an empty (or ignored) slot', () => {
    expect(equipSwapDelta({ itemPower: 42 })).toBe(42);
    expect(equipSwapDelta({ itemPower: 42, occupantPower: 0 })).toBe(42);
  });

  it('defaults every field to a no-op zero', () => {
    expect(equipSwapDelta()).toBe(0);
    expect(equipSwapDelta({})).toBe(0);
  });

  describe('a two-handed weapon that strands the off-hand', () => {
    // Beats the 1H weapon it replaces but NOT the weapon + off-hand together:
    // 120 > 100, yet 120 < 100 + 40 — so it is a downgrade, not an upgrade.
    it('subtracts the stranded off-hand, so it wins only vs. weapon + off-hand combined', () => {
      expect(equipSwapDelta({ itemPower: 120, occupantPower: 100, strandedOffhandPower: 40 })).toBe(-20);
    });

    it('reads as an upgrade once it clears the weapon AND off-hand combined', () => {
      expect(equipSwapDelta({ itemPower: 160, occupantPower: 100, strandedOffhandPower: 40 })).toBe(20);
    });

    it('does not subtract an off-hand that survives the swap (Titan\'s Grip / a bow + quiver)', () => {
      // strandedOffhandPower stays 0 when the off-hand keeps its slot.
      expect(equipSwapDelta({ itemPower: 130, occupantPower: 100, strandedOffhandPower: 0 })).toBe(30);
    });
  });

  describe('an off-hand that cannot be equipped (a two-hander fills the hand)', () => {
    it('is never an upgrade, however much power it carries', () => {
      expect(equipSwapDelta({ itemPower: 999, occupantPower: 0, blocked: true })).toBe(0);
    });

    it('stays zero even when it would otherwise beat the slot occupant', () => {
      expect(equipSwapDelta({ itemPower: 200, occupantPower: 50, blocked: true })).toBe(0);
    });
  });
});
