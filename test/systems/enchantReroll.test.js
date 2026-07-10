import { describe, it, expect } from 'vitest';
import { rerollAllCounts, canRerollAll } from '../../src/systems/enchantReroll.js';

// Rarity caps mirror TIER_AFFIX_CAPS in the legacy shell (only the fields these
// helpers read). Legendary/unique is the widest: 5 stat + 1 attr = 6 modifiers.
const LEGENDARY_CAPS = { stat: 5, attr: 1 };
const RARE_CAPS = { stat: 3, attr: 1 };

describe('rerollAllCounts', () => {
  it('rerolls NOTHING on a blank piece — the reported bug (0 → 6)', () => {
    // A blank legendary must stay blank: reforge preserves the count, so a piece
    // with 0 bonus modifiers rolls 0, never a fresh 1..6.
    expect(rerollAllCounts({ statN: 0, attrN: 0 }, LEGENDARY_CAPS)).toEqual({ stat: 0, attr: 0 });
  });

  it('preserves the piece\'s current bonus count exactly', () => {
    expect(rerollAllCounts({ statN: 2, attrN: 0 }, LEGENDARY_CAPS)).toEqual({ stat: 2, attr: 0 });
    expect(rerollAllCounts({ statN: 3, attrN: 1 }, LEGENDARY_CAPS)).toEqual({ stat: 3, attr: 1 });
  });

  it('rerolls every slot on a fully-loaded piece (count == cap)', () => {
    expect(rerollAllCounts({ statN: 5, attrN: 1 }, LEGENDARY_CAPS)).toEqual({ stat: 5, attr: 1 });
  });

  it('clamps an anomalous over-cap count down to the rarity cap', () => {
    // Never re-add more than the tier allows (defensive; normal pieces stay in cap).
    expect(rerollAllCounts({ statN: 9, attrN: 4 }, RARE_CAPS)).toEqual({ stat: 3, attr: 1 });
  });

  it('never returns a negative count', () => {
    expect(rerollAllCounts({ statN: -3, attrN: -1 }, LEGENDARY_CAPS)).toEqual({ stat: 0, attr: 0 });
  });

  it('floors fractional counts and defaults missing caps to zero', () => {
    expect(rerollAllCounts({ statN: 2.9, attrN: 1.5 }, LEGENDARY_CAPS)).toEqual({ stat: 2, attr: 1 });
    expect(rerollAllCounts({ statN: 2, attrN: 1 }, {})).toEqual({ stat: 0, attr: 0 });
  });
});

describe('canRerollAll', () => {
  it('is false when the piece carries no bonus modifiers', () => {
    expect(canRerollAll({ statN: 0, attrN: 0 })).toBe(false);
    expect(canRerollAll({})).toBe(false);
  });

  it('is true when the piece has at least one bonus modifier to reforge', () => {
    expect(canRerollAll({ statN: 1, attrN: 0 })).toBe(true);
    expect(canRerollAll({ statN: 0, attrN: 1 })).toBe(true);
    expect(canRerollAll({ statN: 3, attrN: 1 })).toBe(true);
  });

  it('ignores negative noise', () => {
    expect(canRerollAll({ statN: -2, attrN: -1 })).toBe(false);
  });
});
