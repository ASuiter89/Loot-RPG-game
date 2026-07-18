// ── HUD FIELD-KIT LOGIC (pure) ──
// Lookups and ownership math over the HUD_UPGRADES catalog, kept free of DOM / RNG /
// clock so it's unit-tested. The game shell (src/legacy/game.js) stores the owned
// flags on player.hudUpgrades, spends the gold, and gates each HUD element on
// hudOwned(); this module owns only the data-derived helpers around that.
import { HUD_UPGRADES } from '../data/hudUpgrades.js';

// The catalog's keys, in display order. The single source an agent / migration can
// enumerate without re-listing the seven strings.
export const HUD_UPGRADE_KEYS = HUD_UPGRADES.map((u) => u.key);

// The catalog entry for a key (from the given catalog, defaulting to the shipped
// one), or null when unknown.
export function hudUpgradeById(key, catalog = HUD_UPGRADES) {
  return (Array.isArray(catalog) ? catalog : []).find((u) => u && u.key === key) || null;
}

// Gold price of an upgrade. Unknown keys — and any malformed/negative price — cost 0
// (the shell still guards the purchase, so a bad key can never be "bought" anyway).
export function hudUpgradeCost(key, catalog = HUD_UPGRADES) {
  const u = hudUpgradeById(key, catalog);
  const p = u && u.price;
  return typeof p === 'number' && p > 0 ? Math.floor(p) : 0;
}

// Does the given owned-map grant `key`? Tolerates a missing/!object map (a brand-new
// or malformed hero) as "owns nothing".
export function hudOwns(owned, key) {
  return !!(owned && typeof owned === 'object' && owned[key]);
}

// A fresh owned-map with EVERY upgrade granted — the migration seed for saves that
// predate the Field Kit, so an existing hero never loses a HUD piece they always had.
export function allHudUpgradesOwned(catalog = HUD_UPGRADES) {
  const out = {};
  for (const u of (Array.isArray(catalog) ? catalog : [])) if (u && u.key) out[u.key] = true;
  return out;
}

// How many of the catalog's upgrades an owned-map has (for a "3/7 kitted" style
// readout). Counts only real catalog keys, so stray flags don't inflate it.
export function hudUpgradesOwnedCount(owned, catalog = HUD_UPGRADES) {
  let n = 0;
  for (const u of (Array.isArray(catalog) ? catalog : [])) if (u && u.key && hudOwns(owned, u.key)) n++;
  return n;
}
