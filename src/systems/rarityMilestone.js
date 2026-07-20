// First-of-rarity milestone — the FIRST time a hero picks up each coloured mid-tier
// (green/blue/purple) stops the world with a loot banner, the same celebration a
// legendary earns, so the moment a new rarity first enters the bag is a real event.
//
// Legendary/unique already banner on EVERY pickup (see lootReveal), so they're not
// milestones here; junk/normal are the floor-1 baseline every hero swims in, so they
// earn no banner. That leaves the three coloured tiers that only unlock as you beat
// the early guardians (green at floor 5, blue/purple at floor 10 — see rarityGate),
// which makes a first find of each a genuine milestone.
//
// Pure: takes the item and the hero's already-celebrated ledger, returns the tier to
// celebrate (or null). The legacy monolith owns the mutable ledger and fires the banner.

// The coloured mid-tiers that earn a one-time first-pickup banner, in rarity order.
export const MILESTONE_TIERS = ['uncommon', 'rare', 'epic'];

// Banner kicker per tier — named by the COLOUR the tier communicates (rarity is only
// ever spoken in colour), matching how a player refers to a "first green / blue / purple".
export const MILESTONE_KICKER = {
  uncommon: 'FIRST GREEN',
  rare: 'FIRST BLUE',
  epic: 'FIRST PURPLE',
};

// Is picking up `item` this hero's FIRST of its rarity — a milestone worth a banner?
// `seen` is the ledger of tiers already celebrated (an object map keyed by tier, or
// any falsy value). Returns the tier key to celebrate, or null when the pickup is not
// a fresh-rarity milestone (wrong tier, or already celebrated).
export function firstRarityMilestone(item, seen) {
  if (!item || !item.tier) return null;
  if (!MILESTONE_TIERS.includes(item.tier)) return null;
  if (seen && seen[item.tier]) return null;
  return item.tier;
}

// Seed a first-milestone ledger for a save that predates the feature: mark every
// milestone tier the hero has ALREADY UNLOCKED as celebrated, so a returning hero
// never re-celebrates a colour they've long been finding. A tier still LOCKED for
// their progression stays open, so it fires the first time they finally earn it.
// `locked` is the Set from rarityGate.lockedTiers() (a missing set means nothing is
// locked — everything already unlocked).
export function seedMilestones(locked) {
  const seen = {};
  for (const tier of MILESTONE_TIERS) {
    if (!locked || !locked.has(tier)) seen[tier] = 1;
  }
  return seen;
}
