import { describe, it, expect } from 'vitest';
import { unseenLootCount } from '../../src/systems/lootSeen.js';

describe('unseenLootCount', () => {
  it('counts every item when none have been seen', () => {
    const inv = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(unseenLootCount(inv, new WeakSet())).toBe(3);
  });

  it('returns zero once every item is in the seen set', () => {
    const inv = [{ id: 'a' }, { id: 'b' }];
    const seen = new WeakSet(inv);
    expect(unseenLootCount(inv, seen)).toBe(0);
  });

  it('counts only the items that were added after the snapshot', () => {
    const a = { id: 'a' }, b = { id: 'b' };
    const seen = new WeakSet([a, b]);
    const fresh = { id: 'fresh' };
    expect(unseenLootCount([a, b, fresh], seen)).toBe(1);
  });

  it('matches by object identity, not value — an equal-looking copy still reads new', () => {
    const a = { id: 'a', tier: 'blue' };
    const seen = new WeakSet([a]);
    const lookalike = { id: 'a', tier: 'blue' };
    expect(unseenLootCount([lookalike], seen)).toBe(1);
  });

  it('ignores removed items — a sold seen/unseen item simply leaves the bag', () => {
    const a = { id: 'a' }, b = { id: 'b' };
    const seen = new WeakSet([a]);
    // b (unseen) is sold off; only what remains in the bag is counted.
    expect(unseenLootCount([a], seen)).toBe(0);
  });

  it('skips null / falsy entries in the bag array', () => {
    const a = { id: 'a' };
    expect(unseenLootCount([null, a, undefined], new WeakSet())).toBe(1);
  });

  it('is defensive about malformed input', () => {
    expect(unseenLootCount(null, new WeakSet())).toBe(0);
    expect(unseenLootCount([{ id: 'a' }], null)).toBe(0);
    expect(unseenLootCount([{ id: 'a' }], {})).toBe(0);
    expect(unseenLootCount('nope', new WeakSet())).toBe(0);
  });
});
