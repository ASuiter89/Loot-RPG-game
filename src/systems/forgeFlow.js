// Progressive-disclosure staging for the Craftsman (Forge) menu.
//
// The bench opens with nothing selected and reveals one choice at a time: first the
// item type, then the base (weapons take an extra step — a category, then a type
// within it), and only once a base is chosen do the rarity, preview and FORGE
// button appear. Encoding the reveal order here keeps it in one place and testable.
//
// Pure: it reads the current selections and reports which sections to draw. No DOM,
// no module state — the legacy renderer owns those and calls in here to decide the
// layout.

// The ordered stages the forge walks through, given the live selections:
//   'type'     → nothing picked; only the item-type picker shows
//   'category' → a weapon slot is picked; reveal its category picker
//   'base'     → choosing a base (weapons: a category is picked, choosing a type)
//   'ready'    → a base is picked; reveal rarity + preview + the FORGE button
export function forgeStage({ slot, cat, base, isWeapon }) {
  if (!slot) return 'type';
  if (isWeapon && !cat) return 'category';
  if (!base) return 'base';
  return 'ready';
}

// Which sections the renderer should draw for the given selections. Derived from
// forgeStage so the reveal order lives in exactly one spot. Nothing below the item
// type shows until the step above it has been chosen.
export function forgeSections(sel) {
  const stage = forgeStage(sel);
  const slotPicked = stage !== 'type';
  const catPicked = stage === 'base' || stage === 'ready';
  const weapon = !!sel.isWeapon;
  return {
    stage,
    itemType: true,                    // the item-type picker is always visible
    weaponCats: weapon && slotPicked,  // weapon category grid (weapons only)
    weaponTypes: weapon && catPicked,  // weapon sub-type grid (after a category)
    baseList: !weapon && slotPicked,   // flat base grid (every non-weapon slot)
    rarity: stage === 'ready',         // rarity + preview + FORGE button
  };
}
