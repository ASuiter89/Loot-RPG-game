import { describe, it, expect } from 'vitest';
import {
  mealSignature, emptyMealSlots, sanitizeMealSlots, filledSlotCount,
  assignMealToSlot, takeFromMealSlot, returnSlotToPantry,
} from '../../src/systems/meals.js';

const bowl = (name, fx = { hp: 10 }, floors = 3, recipe) => ({ name, fx, floors, recipe });

describe('mealSignature', () => {
  it('is empty for a missing bowl', () => {
    expect(mealSignature(null)).toBe('');
    expect(mealSignature(undefined)).toBe('');
  });
  it('matches bowls with identical name/floors/fx regardless of fx key order', () => {
    const a = bowl('Spicy', { hp: 10, mp: 5 });
    const b = bowl('Spicy', { mp: 5, hp: 10 });
    expect(mealSignature(a)).toBe(mealSignature(b));
  });
  it('differs on name, floors, fx value, or recipe', () => {
    const base = bowl('Spicy', { hp: 10 }, 3, 'r1');
    expect(mealSignature(base)).not.toBe(mealSignature(bowl('Mild', { hp: 10 }, 3, 'r1')));
    expect(mealSignature(base)).not.toBe(mealSignature(bowl('Spicy', { hp: 10 }, 4, 'r1')));
    expect(mealSignature(base)).not.toBe(mealSignature(bowl('Spicy', { hp: 20 }, 3, 'r1')));
    expect(mealSignature(base)).not.toBe(mealSignature(bowl('Spicy', { hp: 10 }, 3, 'r2')));
  });
  it('tolerates a bowl with no fx', () => {
    expect(mealSignature({ name: 'Plain', floors: 2 })).toBe('|Plain|2|');
  });
});

describe('emptyMealSlots', () => {
  it('makes an array of nulls of the given length', () => {
    expect(emptyMealSlots(3)).toEqual([null, null, null]);
  });
  it('clamps a negative/garbage count to an empty array', () => {
    expect(emptyMealSlots(-2)).toEqual([]);
    expect(emptyMealSlots(undefined)).toEqual([]);
  });
});

describe('sanitizeMealSlots', () => {
  it('returns all-empty for non-array input', () => {
    expect(sanitizeMealSlots(null, 2)).toEqual([null, null]);
    expect(sanitizeMealSlots('nope', 2)).toEqual([null, null]);
  });
  it('keeps valid slots and drops malformed / zero-qty ones', () => {
    const raw = [
      { bowl: bowl('A'), qty: 2 },
      { bowl: bowl('B'), qty: 0 },      // zero qty -> dropped
      { bowl: { name: 'C' }, qty: 1 },  // no fx -> dropped
      { qty: 3 },                       // no bowl -> dropped
    ];
    const out = sanitizeMealSlots(raw, 4);
    expect(out[0]).toEqual({ bowl: { name: 'A', fx: { hp: 10 }, floors: 3, recipe: undefined }, qty: 2 });
    expect(out[1]).toBeNull();
    expect(out[2]).toBeNull();
    expect(out[3]).toBeNull();
  });
  it('floors fractional quantities and pads/truncates to slotCount', () => {
    const out = sanitizeMealSlots([{ bowl: bowl('A'), qty: 2.9 }], 3);
    expect(out).toHaveLength(3);
    expect(out[0].qty).toBe(2);
    expect(out[1]).toBeNull();
  });
});

describe('filledSlotCount', () => {
  it('counts only non-empty slots', () => {
    expect(filledSlotCount([null, { bowl: bowl('A'), qty: 1 }, null])).toBe(1);
    expect(filledSlotCount([])).toBe(0);
    expect(filledSlotCount('x')).toBe(0);
  });
});

describe('assignMealToSlot', () => {
  it('moves the whole matching stack out of the pantry into an empty slot', () => {
    const pantry = [bowl('Spicy'), bowl('Mild'), bowl('Spicy'), bowl('Spicy')];
    const r = assignMealToSlot(pantry, emptyMealSlots(3), 0, 3);
    expect(r.assigned).toBe(3);
    expect(r.pantry).toEqual([bowl('Mild')]);
    expect(r.mealSlots[0]).toEqual({ bowl: bowl('Spicy'), qty: 3 });
    expect(r.mealSlots[1]).toBeNull();
  });
  it('merges into an existing slot of the same meal', () => {
    const slots = sanitizeMealSlots([{ bowl: bowl('Spicy'), qty: 2 }], 3);
    const r = assignMealToSlot([bowl('Spicy'), bowl('Spicy')], slots, 0, 3);
    expect(r.assigned).toBe(2);
    expect(r.mealSlots[0].qty).toBe(4);
    expect(filledSlotCount(r.mealSlots)).toBe(1);
    expect(r.pantry).toEqual([]);
  });
  it('does nothing when the pantry index is empty', () => {
    const r = assignMealToSlot([bowl('Spicy')], emptyMealSlots(2), 5, 2);
    expect(r.assigned).toBe(0);
    expect(r.pantry).toEqual([bowl('Spicy')]);
    expect(r.mealSlots).toEqual([null, null]);
  });
  it('leaves the pantry intact when every slot is full of other meals', () => {
    const slots = [{ bowl: bowl('A'), qty: 1 }, { bowl: bowl('B'), qty: 1 }];
    const r = assignMealToSlot([bowl('Spicy')], slots, 0, 2);
    expect(r.assigned).toBe(0);
    expect(r.pantry).toEqual([bowl('Spicy')]);
    expect(filledSlotCount(r.mealSlots)).toBe(2);
  });
  it('does not mutate the inputs', () => {
    const pantry = [bowl('Spicy')];
    const slots = emptyMealSlots(2);
    assignMealToSlot(pantry, slots, 0, 2);
    expect(pantry).toEqual([bowl('Spicy')]);
    expect(slots).toEqual([null, null]);
  });
});

describe('takeFromMealSlot', () => {
  it('decrements the stack and returns the bowl to apply', () => {
    const slots = [{ bowl: bowl('Spicy'), qty: 2 }];
    const r = takeFromMealSlot(slots, 0, 1);
    expect(r.bowl).toEqual(bowl('Spicy'));
    expect(r.mealSlots[0].qty).toBe(1);
  });
  it('clears the slot when the last bowl is eaten', () => {
    const r = takeFromMealSlot([{ bowl: bowl('Spicy'), qty: 1 }], 0, 1);
    expect(r.bowl).toEqual(bowl('Spicy'));
    expect(r.mealSlots[0]).toBeNull();
  });
  it('returns a null bowl for an empty / out-of-range slot', () => {
    expect(takeFromMealSlot([null], 0, 1).bowl).toBeNull();
    expect(takeFromMealSlot([], 4, 3).bowl).toBeNull();
  });
});

describe('returnSlotToPantry', () => {
  it('pushes the whole stack back to the pantry and clears the slot', () => {
    const slots = [{ bowl: bowl('Spicy'), qty: 3 }];
    const r = returnSlotToPantry([bowl('Mild')], slots, 0, 1);
    expect(r.pantry).toEqual([bowl('Mild'), bowl('Spicy'), bowl('Spicy'), bowl('Spicy')]);
    expect(r.mealSlots[0]).toBeNull();
  });
  it('no-ops for an empty slot', () => {
    const r = returnSlotToPantry([bowl('Mild')], [null, null], 1, 2);
    expect(r.pantry).toEqual([bowl('Mild')]);
    expect(r.mealSlots).toEqual([null, null]);
  });
});
