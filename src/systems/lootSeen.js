// Counting helper behind the LOOT tab's "new loot" badge.
//
// The badge answers a single question — how many items are sitting in the bag
// that the player hasn't looked at in the LOOT list yet? Membership of "already
// seen" is tracked by the caller (a WeakSet of item object refs in the legacy
// shell, seeded when the loot list is on-screen); this function is the pure part:
// count the current bag entries that aren't in that set. Kept DOM- and RNG-free so
// it's deterministic and unit-testable, per the systems/ rules.
//
// `seen` is anything with a `.has(item)` method (Set / WeakSet). Missing / malformed
// inputs count as zero unseen rather than throwing, so a mid-boot call is harmless.
export function unseenLootCount(inventory, seen) {
  if (!Array.isArray(inventory) || !seen || typeof seen.has !== 'function') return 0;
  let n = 0;
  for (const item of inventory) if (item && !seen.has(item)) n++;
  return n;
}
