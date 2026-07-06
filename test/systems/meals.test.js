import { describe, it, expect } from 'vitest';
import {
  mealSignature, emptyMealSlots, sanitizeMealSlots, filledSlotCount,
  assignMealToSlot, assignMealToSlotAt, groupPantry, removePantryStack,
  takeFromMealSlot, returnSlotToPantry,
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

describe('assignMealToSlotAt', () => {
  it('fills the exact empty slot the bowl was dropped on', () => {
    const pantry = [bowl('Spicy'), bowl('Mild'), bowl('Spicy')];
    const r = assignMealToSlotAt(pantry, emptyMealSlots(3), 0, 2, 3);
    expect(r.assigned).toBe(2);
    expect(r.mealSlots[2]).toEqual({ bowl: bowl('Spicy'), qty: 2 });
    expect(r.mealSlots[0]).toBeNull();
    expect(r.pantry).toEqual([bowl('Mild')]);
  });
  it('merges into the target slot when it already holds the same meal', () => {
    const slots = sanitizeMealSlots([null, { bowl: bowl('Spicy'), qty: 1 }, null], 3);
    const r = assignMealToSlotAt([bowl('Spicy'), bowl('Spicy')], slots, 0, 1, 3);
    expect(r.assigned).toBe(2);
    expect(r.mealSlots[1].qty).toBe(3);
  });
  it('refuses a slot already holding a different meal (assigned 0, nothing moved)', () => {
    const slots = [{ bowl: bowl('Other'), qty: 1 }, null];
    const r = assignMealToSlotAt([bowl('Spicy')], slots, 0, 0, 2);
    expect(r.assigned).toBe(0);
    expect(r.pantry).toEqual([bowl('Spicy')]);
    expect(r.mealSlots[0]).toEqual({ bowl: bowl('Other'), qty: 1 });
  });
  it('no-ops for an out-of-range slot or missing pantry bowl', () => {
    expect(assignMealToSlotAt([bowl('Spicy')], emptyMealSlots(2), 0, 5, 2).assigned).toBe(0);
    expect(assignMealToSlotAt([bowl('Spicy')], emptyMealSlots(2), 9, 0, 2).assigned).toBe(0);
  });
  it('does not mutate the inputs', () => {
    const pantry = [bowl('Spicy')];
    const slots = emptyMealSlots(2);
    assignMealToSlotAt(pantry, slots, 0, 0, 2);
    expect(pantry).toEqual([bowl('Spicy')]);
    expect(slots).toEqual([null, null]);
  });
});

describe('groupPantry', () => {
  it('is empty for an empty / non-array pantry', () => {
    expect(groupPantry([])).toEqual([]);
    expect(groupPantry(null)).toEqual([]);
  });
  it('collapses same-meal bowls into one entry with a count and the first index', () => {
    const pantry = [bowl('Spicy'), bowl('Mild'), bowl('Spicy'), bowl('Spicy')];
    const groups = groupPantry(pantry);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ qty: 3, index: 0 });
    expect(groups[0].bowl.name).toBe('Spicy');
    expect(groups[1]).toMatchObject({ qty: 1, index: 1 });
    expect(groups[1].bowl.name).toBe('Mild');
  });
  it('keeps first-seen order', () => {
    const groups = groupPantry([bowl('C'), bowl('A'), bowl('C'), bowl('B')]);
    expect(groups.map(g => g.bowl.name)).toEqual(['C', 'A', 'B']);
  });
});

describe('removePantryStack', () => {
  it('drops every bowl matching the one at the index', () => {
    const pantry = [bowl('Spicy'), bowl('Mild'), bowl('Spicy'), bowl('Spicy')];
    const r = removePantryStack(pantry, 0);
    expect(r.removed).toBe(3);
    expect(r.pantry).toEqual([bowl('Mild')]);
  });
  it('no-ops for an out-of-range index', () => {
    const r = removePantryStack([bowl('Spicy')], 9);
    expect(r.removed).toBe(0);
    expect(r.pantry).toEqual([bowl('Spicy')]);
  });
  it('does not mutate the input pantry', () => {
    const pantry = [bowl('Spicy'), bowl('Spicy')];
    removePantryStack(pantry, 0);
    expect(pantry).toHaveLength(2);
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
