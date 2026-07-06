// Solo Self-Found (SSF) — a hero who walks alone. Chosen (like Hardcore) on the
// new-hero name screen and locked in for that hero's whole life, and freely
// stackable WITH Hardcore. An SSF hero never touches the account-shared pools:
// the town Vault (banked gold + stored gear) is sealed, town shops charge
// carried coin only, and crafting materials live in a PRIVATE per-hero wallet
// on the save instead of the shared cross-hero stash. Only what this hero finds
// on its own run can be used.
//
// These are the pure helpers for that per-hero wallet — a plain
// { scrap, glimmer, core, chaos } record living on the player save, mutated in
// place like the rest of the save state. Logic only: no DOM, no storage; the
// caller (game.js) decides when a hero is SSF and persists the save.

// Whether this hero plays under Solo Self-Found rules.
export function isSsf(player) {
  return !!(player && player.ssf);
}

// Add n of a material to the per-hero wallet. Amounts are whole and never
// negative — a bad n (NaN, negative, fractional) can't corrupt the wallet.
export function walletGain(wallet, key, n) {
  const add = Math.max(0, Math.floor(n) || 0);
  if (add > 0) wallet[key] = (wallet[key] || 0) + add;
  return wallet;
}

// Pay a mixed cost's material components from the per-hero wallet (its gold
// component is the caller's business). Clamps at zero so a stale UI double-spend
// can never drive a count negative. Returns true if any material was spent, so
// the caller knows whether the save needs persisting.
export function walletSpend(wallet, cost, keys) {
  let spent = false;
  for (const k of keys) {
    const pay = Math.max(0, Math.floor(cost[k]) || 0);
    if (pay <= 0) continue;
    wallet[k] = Math.max(0, (wallet[k] || 0) - pay);
    spent = true;
  }
  return spent;
}
