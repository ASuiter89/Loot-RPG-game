// ── GLYPHS — the Weave's socketable gems (pure data) ─────────────────────────
//
// Glyphs are the loot half of the Ascendant Weave: gems that drop from ENDLESS
// depth and slot into the board's sockets, multiplying the nodes they physically
// cover (see src/systems/ascendantWeave.js ▸ weaveStatContribution). A glyph's TIER
// sets its strength band and reach; deeper Endless unlocks rarer, stronger tiers, so
// the endless grind feeds the board without ever making it unbounded (the board's
// node count is fixed — glyphs just make the nodes you already chose count for more).
//
// This mirrors the authoring clarity of src/data/uniques.js: one flat, hand-tuned
// table, no logic. The roll math lives in src/systems/glyphRoll.js. Colours are
// bespoke gem art (like the loot-tier palette), not design tokens.
export const GLYPHS = {
  // Five tiers, dim → astral, echoing the loot-rarity ramp. `radius` is the socket
  // reach a glyph of this tier projects (bigger tier → covers more nodes). `valueBand`
  // is the fractional bonus it rolls: glyphPower() turns a value v into a ×(1+v)
  // multiplier on every covered node, so a tier-1 nudges a node ~+6–12% and a maxed
  // astral glyph nearly +52%. Bounded on purpose.
  tiers: [
    { tier: 1, name: 'Dim Glyph',     color: '#8a8f98', radius: 12, valueBand: { min: 0.06, max: 0.12 } },
    { tier: 2, name: 'Lit Glyph',     color: '#5ea9ff', radius: 14, valueBand: { min: 0.10, max: 0.18 } },
    { tier: 3, name: 'Bright Glyph',  color: '#a97bff', radius: 16, valueBand: { min: 0.16, max: 0.26 } },
    { tier: 4, name: 'Radiant Glyph', color: '#ff9f43', radius: 18, valueBand: { min: 0.24, max: 0.38 } },
    { tier: 5, name: 'Astral Glyph',  color: '#ff5a5a', radius: 20, valueBand: { min: 0.34, max: 0.52 } },
  ],

  // A small secondary flavour rolled alongside the main value — a rider the shell can
  // surface for identity ("Echoing Astral Glyph"). Kept as data so new riders are a
  // one-line add; the roll picks exactly one uniformly.
  tertiaryBonuses: [
    { key: 'reach',  label: 'Warding — +1 to this socket’s reach' },
    { key: 'echo',   label: 'Echoing — the smallest covered node counts twice' },
    { key: 'attune', label: 'Attuned — +2 to covered attribute nodes' },
    { key: 'temper', label: 'Tempered — +5% to covered defensive nodes' },
  ],

  // The Endless-depth wall each tier sits behind: a glyph of that tier can only roll
  // once the run's Endless depth is at least `minEndlessDepth`. Tier 1 is always
  // available; the rarest tiers demand a deep dive. rollGlyph() takes the HIGHEST
  // tier the current depth unlocks.
  depthGates: [
    { tier: 1, minEndlessDepth: 0 },
    { tier: 2, minEndlessDepth: 5 },
    { tier: 3, minEndlessDepth: 12 },
    { tier: 4, minEndlessDepth: 22 },
    { tier: 5, minEndlessDepth: 35 },
  ],
};
