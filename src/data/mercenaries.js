// Sellsword (mercenary) content + hire-price tuning — pure values, read by
// src/systems/mercPricing.js and the town Sellsword camp. A merc is a single
// hired companion that spawns beside the hero on each floor of its contract and
// fights like a strong, self-reviving summon.
//
// `mult` is the merc's power/price tier: it scales both how hard the companion
// hits (see spawnMerc) and what the contract costs. `minion` is the base creature
// its combat profile + sprite come from; `accent` tints its hire card (mirrors
// the Mystic pact cards' per-pact accent).
export const MERC_TYPES = [
  { id: 'blade',  name: 'Sellsword',   minion: 'shadow',     mult: 1.15, accent: '#9fb4d8', desc: 'A swift blade — fast, hits hard.' },
  { id: 'marks',  name: 'Marksman',    minion: 'skelarcher', mult: 1.10, accent: '#8fd07a', desc: 'Fires on foes from across the room.' },
  { id: 'warden', name: 'Warden',      minion: 'golem',      mult: 1.30, accent: '#7fa8d8', desc: 'A hulking tank — huge health, steady.' },
  { id: 'hound',  name: 'Hound',       minion: 'wolf',       mult: 1.12, accent: '#d8a878', desc: 'A snarling hound — quick, darts in and out.' },
  { id: 'pyre',   name: 'Flame Adept', minion: 'elemental',  mult: 1.20, accent: '#ff8a4d', desc: 'Hurls fire on foes across the room.' },
  { id: 'seer',   name: 'Acolyte',     minion: 'spirit',     mult: 1.22, accent: '#e6d27f', desc: 'A holy spirit — smites foes from afar.' },
];

// Which animated town-NPC walk sprite each merc type draws with — in the hire
// card and as the companion on the dungeon map. Types without a bespoke walk
// sheet fall back to their (real) minion sprite in both places.
export const MERC_ART = { blade: 'sellsword', marks: 'marks', warden: 'warden' };

// Contract-length tiers offered for every merc — mirror the Mystic's multi-floor
// pacts so you can sign on for a quick test, a short delve, or a long haul. Each
// tier's `mult` is the WHOLE contract's cost relative to one floor. Because that
// grows a touch slower than the floor count, the per-floor rate eases as you
// commit to more floors — but far more gently than the Mystic's pact discount, so
// a long contract stays a serious sum (10 floors ≈ 8% off per floor, 30 ≈ 15%).
export const MERC_DURATIONS = [
  { floors: 1,  mult: 1 },
  { floors: 10, mult: 9.2 },
  { floors: 30, mult: 25.5 },
];

// Per-floor hire-rate tuning (see src/systems/mercPricing.js). A merc is a
// premium, persistent companion, so the base is far higher than the old flat fee
// and the depth term is steep — the price climbs sharply with the deepest floor
// the hero has reached, so deep heroes pay deep-dungeon wages. The Sellsword only
// opens on reaching Brutal (max depth ≥ 51), so these are tuned to feel right from
// there on down.
export const MERC_PRICE = {
  floorBase: 60,      // gold per contract floor at depth 1 (before the tier mult)
  floorPerDepth: 18,  // added per floor of deepest depth reached
};
