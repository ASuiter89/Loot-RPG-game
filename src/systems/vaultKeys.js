// Vault-key carrying rules. Pure and dependency-free so the count can be unit
// tested away from the legacy god-object.
//
// A vault key is picked up off the floor and spent to shove open a locked vault
// door. Keys PERSIST across floors (they live on player.keys and survive a save),
// so a key found on a floor whose door you can't reach — or never bother with —
// isn't wasted: carry it down and spend it on a later locked door, and stockpile
// several if you like.

/** Coerce any stored value to a non-negative integer key count (0 on garbage). */
function normKeys(keys) {
  const n = Math.floor(Number(keys));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Whether the hero is carrying at least one vault key. */
export function hasVaultKey(keys) {
  return normKeys(keys) > 0;
}

/** Add a picked-up key to the carried count. */
export function addVaultKey(keys) {
  return normKeys(keys) + 1;
}

/**
 * Try to open a vault door by spending one carried key.
 * @param {number} keys current carried count
 * @returns {{ keys: number, opened: boolean }} the new count, and whether a key
 *   was actually spent (false when the hero holds none — the door stays locked).
 */
export function spendVaultKey(keys) {
  const n = normKeys(keys);
  return n > 0 ? { keys: n - 1, opened: true } : { keys: n, opened: false };
}
