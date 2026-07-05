// Cooking pot math — pure helpers over the ramen pot (toppingKey -> count) and the
// player's owned toppings (toppingKey -> count). The legacy shell owns cookPot and
// player.ingredients and calls these; no DOM / RNG / clock here.

// How many identical bowls the current pot can cook from what you own: the pot needs
// `pot[k]` of each topping per bowl, so the limiter is the topping you can spare the
// fewest full pots of. Returns 0 for an empty pot (nothing to cook).
export function cookableCount(pot, ingredients) {
  const keys = Object.keys(pot || {}).filter(k => pot[k] > 0);
  if (!keys.length) return 0;
  const have = ingredients || {};
  let max = Infinity;
  for (const k of keys) {
    const per = pot[k];
    const own = have[k] || 0;
    max = Math.min(max, Math.floor(own / per));
  }
  return Math.max(0, max === Infinity ? 0 : max);
}

// Trim a preset list of batch sizes to what's actually cookable, always leading with
// a single bowl and folding in the exact maximum so "cook everything" is reachable.
// e.g. presets [1,3,5,10] with max 7 -> [1,3,5,7]; with max 12 -> [1,3,5,10,12].
export function cookBatchOptions(maxCookable, presets = [1, 3, 5, 10]) {
  const max = Math.max(0, Math.floor(maxCookable) || 0);
  if (max <= 0) return [];
  const out = presets.filter(n => n >= 1 && n <= max);
  if (!out.includes(1)) out.unshift(1);
  if (max > 1 && !out.includes(max)) out.push(max);
  return out.sort((a, b) => a - b);
}
