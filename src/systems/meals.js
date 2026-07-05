// Meal-slot logic — pure functions over the pantry (cooked-but-unassigned bowls)
// and the meal slots (stacks of a meal you assign at the Ramen House so they can be
// eaten from the HUD in the dungeon without recooking). No DOM / RNG / clock; the
// legacy shell owns player.pantry / player.mealSlots and calls these.
//
// A "bowl" is { name, fx, floors, recipe? } (see the cooking system in game.js).
// A meal slot is null or { bowl, qty } — one representative bowl plus how many are
// stacked. Bowls are the "same meal" when they grant the same buff, keyed by
// mealSignature() (recipe + name + floors + a canonical fx signature).

// Canonical key: two bowls with the same signature stack into one slot.
export function mealSignature(bowl) {
  if (!bowl) return '';
  const fx = bowl.fx || {};
  const fxSig = Object.keys(fx).sort().map(k => `${k}:${fx[k]}`).join(',');
  return `${bowl.recipe || ''}|${bowl.name || ''}|${bowl.floors || 0}|${fxSig}`;
}

// A fresh, all-empty slot array of the given length.
export function emptyMealSlots(slotCount) {
  return Array.from({ length: Math.max(0, slotCount | 0) }, () => null);
}

// Shallow copy of a bowl, keeping only the persisted fields.
function cloneBowl(b) {
  return { name: b.name, fx: b.fx, floors: b.floors || 0, recipe: b.recipe };
}

// Coerce arbitrary (e.g. loaded-save) data into a valid slot array of length
// slotCount — each entry a well-formed { bowl, qty>0 } or null.
export function sanitizeMealSlots(raw, slotCount) {
  const out = emptyMealSlots(slotCount);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < out.length; i++) {
    const s = raw[i];
    const qty = s && Math.floor(s.qty);
    if (s && s.bowl && s.bowl.fx && typeof s.bowl.name === 'string' && qty > 0) {
      out[i] = { bowl: cloneBowl(s.bowl), qty };
    }
  }
  return out;
}

// Count the filled slots.
export function filledSlotCount(mealSlots) {
  return (Array.isArray(mealSlots) ? mealSlots : []).filter(s => s && s.qty > 0).length;
}

// Move EVERY pantry bowl matching the one at pantryIndex into a meal slot — the whole
// stack — so it can be eaten repeatedly from the HUD. Merges into an existing slot of
// the same meal, else fills the first empty slot. Returns new pantry + mealSlots and
// how many bowls were assigned (0 when the bowl is missing or no slot has room — the
// pantry is left intact in that case).
export function assignMealToSlot(pantry, mealSlots, pantryIndex, slotCount) {
  const slots = sanitizeMealSlots(mealSlots, slotCount);
  const src = Array.isArray(pantry) ? pantry.slice() : [];
  const target = src[pantryIndex];
  if (!target) return { pantry: src, mealSlots: slots, assigned: 0 };
  const sig = mealSignature(target);
  // Prefer an existing slot of the same meal; else the first empty slot.
  let idx = slots.findIndex(s => s && mealSignature(s.bowl) === sig);
  if (idx < 0) idx = slots.findIndex(s => !s);
  if (idx < 0) return { pantry: src, mealSlots: slots, assigned: 0 }; // all slots full
  // Pull every matching bowl out of the pantry.
  const kept = [];
  let qty = 0, rep = null;
  for (const b of src) {
    if (mealSignature(b) === sig) { qty++; if (!rep) rep = b; }
    else kept.push(b);
  }
  if (qty === 0) return { pantry: src, mealSlots: slots, assigned: 0 };
  const existing = slots[idx];
  slots[idx] = { bowl: existing ? existing.bowl : cloneBowl(rep), qty: (existing ? existing.qty : 0) + qty };
  return { pantry: kept, mealSlots: slots, assigned: qty };
}

// Assign a pantry bowl's whole matching stack into ONE SPECIFIC slot (the drag-drop
// target). Merges when that slot already holds the same meal, fills it when empty,
// and refuses (assigned 0) when it holds a DIFFERENT meal — the shell can then fall
// back to the auto-placing assignMealToSlot. Otherwise mirrors assignMealToSlot.
export function assignMealToSlotAt(pantry, mealSlots, pantryIndex, slotIndex, slotCount) {
  const slots = sanitizeMealSlots(mealSlots, slotCount);
  const src = Array.isArray(pantry) ? pantry.slice() : [];
  const target = src[pantryIndex];
  if (!target) return { pantry: src, mealSlots: slots, assigned: 0 };
  if (slotIndex < 0 || slotIndex >= slots.length) return { pantry: src, mealSlots: slots, assigned: 0 };
  const sig = mealSignature(target);
  const existing = slots[slotIndex];
  if (existing && mealSignature(existing.bowl) !== sig) return { pantry: src, mealSlots: slots, assigned: 0 };
  const kept = [];
  let qty = 0, rep = null;
  for (const b of src) {
    if (mealSignature(b) === sig) { qty++; if (!rep) rep = b; }
    else kept.push(b);
  }
  if (qty === 0) return { pantry: src, mealSlots: slots, assigned: 0 };
  slots[slotIndex] = { bowl: existing ? existing.bowl : cloneBowl(rep), qty: (existing ? existing.qty : 0) + qty };
  return { pantry: kept, mealSlots: slots, assigned: qty };
}

// Collapse the pantry into ONE entry per meal (bowls that share a mealSignature),
// each carrying a representative bowl, how many are stacked, and the pantry index of
// the FIRST bowl in the stack — so an action button can address the stack by that
// index (eat one, slot the whole stack, trash the whole stack). First-seen order.
export function groupPantry(pantry) {
  const src = Array.isArray(pantry) ? pantry : [];
  const order = [];
  const bySig = new Map();
  for (let i = 0; i < src.length; i++) {
    const sig = mealSignature(src[i]);
    let g = bySig.get(sig);
    if (!g) { g = { bowl: src[i], qty: 0, index: i, sig }; bySig.set(sig, g); order.push(sig); }
    g.qty++;
  }
  return order.map(sig => bySig.get(sig));
}

// Drop EVERY bowl matching the one at pantryIndex from the pantry (Trash — discard a
// whole stack you'll never eat). Returns the new pantry + how many were removed.
export function removePantryStack(pantry, pantryIndex) {
  const src = Array.isArray(pantry) ? pantry.slice() : [];
  const target = src[pantryIndex];
  if (!target) return { pantry: src, removed: 0 };
  const sig = mealSignature(target);
  const kept = [];
  let removed = 0;
  for (const b of src) { if (mealSignature(b) === sig) removed++; else kept.push(b); }
  return { pantry: kept, removed };
}

// Eat one bowl from a slot: returns the bowl to apply (or null) and updated slots
// (the slot is cleared once its last bowl is used).
export function takeFromMealSlot(mealSlots, slotIndex, slotCount) {
  const slots = sanitizeMealSlots(mealSlots, slotCount);
  const s = slots[slotIndex];
  if (!s || s.qty <= 0) return { mealSlots: slots, bowl: null };
  const left = s.qty - 1;
  slots[slotIndex] = left > 0 ? { bowl: s.bowl, qty: left } : null;
  return { mealSlots: slots, bowl: cloneBowl(s.bowl) };
}

// Send a slot's whole stack back to the pantry (Ramen-House-only un-assign).
export function returnSlotToPantry(pantry, mealSlots, slotIndex, slotCount) {
  const slots = sanitizeMealSlots(mealSlots, slotCount);
  const src = Array.isArray(pantry) ? pantry.slice() : [];
  const s = slots[slotIndex];
  if (!s || s.qty <= 0) return { pantry: src, mealSlots: slots };
  for (let i = 0; i < s.qty; i++) src.push(cloneBowl(s.bowl));
  slots[slotIndex] = null;
  return { pantry: src, mealSlots: slots };
}
