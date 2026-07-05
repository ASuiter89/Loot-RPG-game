import { describe, it, expect } from 'vitest';
import { cookableCount, cookBatchOptions } from '../../src/systems/cooking.js';

describe('cookableCount', () => {
  it('is zero for an empty pot', () => {
    expect(cookableCount({}, { pork: 99 })).toBe(0);
    expect(cookableCount(null, { pork: 99 })).toBe(0);
  });

  it('counts full pots for a single-topping bowl', () => {
    expect(cookableCount({ pork: 3 }, { pork: 10 })).toBe(3); // floor(10/3)
    expect(cookableCount({ pork: 3 }, { pork: 3 })).toBe(1);
    expect(cookableCount({ pork: 3 }, { pork: 2 })).toBe(0);
  });

  it('is limited by the scarcest topping in a mixed pot', () => {
    expect(cookableCount({ pork: 2, egg: 1 }, { pork: 7, egg: 2 })).toBe(2); // min(3,2)
    expect(cookableCount({ pork: 1, egg: 1, nori: 1 }, { pork: 5, egg: 4, nori: 1 })).toBe(1);
  });

  it('treats missing owned toppings as zero', () => {
    expect(cookableCount({ pork: 1, egg: 1 }, { pork: 5 })).toBe(0);
    expect(cookableCount({ pork: 1 }, {})).toBe(0);
    expect(cookableCount({ pork: 1 }, undefined)).toBe(0);
  });

  it('ignores zero-count pot entries', () => {
    expect(cookableCount({ pork: 3, egg: 0 }, { pork: 9 })).toBe(3);
  });
});

describe('cookBatchOptions', () => {
  it('is empty when nothing is cookable', () => {
    expect(cookBatchOptions(0)).toEqual([]);
    expect(cookBatchOptions(-3)).toEqual([]);
  });

  it('is just [1] when only one bowl is possible', () => {
    expect(cookBatchOptions(1)).toEqual([1]);
  });

  it('keeps affordable presets and appends the exact max', () => {
    expect(cookBatchOptions(7)).toEqual([1, 3, 5, 7]);
    expect(cookBatchOptions(12)).toEqual([1, 3, 5, 10, 12]);
    expect(cookBatchOptions(10)).toEqual([1, 3, 5, 10]);
    expect(cookBatchOptions(4)).toEqual([1, 3, 4]);
  });

  it('always leads with a single bowl even with custom presets', () => {
    expect(cookBatchOptions(5, [2, 4])).toEqual([1, 2, 4, 5]);
  });
});
