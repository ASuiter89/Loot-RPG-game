// ── HEALER-SOLD FLOOR BUFFS ──
// Besides a full rest, the town Healer grants a "Rested" bonus with every paid
// rest and sells premium BLESSINGS — expensive, impactful buffs that last a few
// floors. Both reuse the food-buff `fx` channel (see foodFx / healerFx in the game
// shell), so their bonuses fold straight into the existing combat formulas without
// a parallel stat system.
//
// fx keys understood by the formulas (the same set the ramen buffs use):
//   dmgPct · maxHpPct · regen · critPct · goldPct · dropPct · xpPct
// (values are fractions except `regen`, which is a flat per-beat trickle.)

// How many floors the free Rested bonus lasts before it fades. Deliberately short
// so it's a burst you renew with the next rest, not permanent power creep.
export const HEALER_BUFF_FLOORS = 3;

// Blessings are bought outright at a steep, level-scaled price, so they run longer
// than the rest-granted bonus — long enough that a purchase carries a run.
export const BLESSING_FLOORS = 5;

// The Rested bonus, granted free with every paid Full Rest. A well-rested hero is
// sharper — bonus XP for the next few floors. `kind:'rested'` gives it its own slot
// so it coexists with a purchased Blessing.
export const RESTED_BUFF = {
  id: 'rested', kind: 'rested', name: 'Rested', icon: 'ic_heart',
  fx: { xpPct: 0.25 }, floors: HEALER_BUFF_FLOORS,
  desc: '+25% XP',
};

// The Blessings the Healer sells. Only ONE Blessing is active at a time (buying a
// new one replaces the old), so the pick is a real choice. Each carries a `base`
// price that climbs with hero level (see blessingCost), keeping a Blessing a steep,
// meaningful gold sink. Magnitudes sit ~1.5–2× the strongest comparable ramen buff,
// which — with the short duration and one-at-a-time limit — is what makes them worth
// the premium. `kind:'blessing'` marks them mutually exclusive.
export const HEALER_BLESSINGS = [
  { id: 'bless_might',   kind: 'blessing', name: 'Blessing of Might',   icon: 'w_sword',   base: 600, fx: { dmgPct: 0.30 },                 floors: BLESSING_FLOORS, desc: '+30% damage dealt' },
  { id: 'bless_vigor',   kind: 'blessing', name: 'Blessing of Vigor',   icon: 'a_shield',  base: 600, fx: { maxHpPct: 0.25, regen: 6 },     floors: BLESSING_FLOORS, desc: '+25% max HP & steady regen' },
  { id: 'bless_focus',   kind: 'blessing', name: 'Blessing of Focus',   icon: 'ic_target', base: 600, fx: { critPct: 0.20 },                floors: BLESSING_FLOORS, desc: '+20% crit chance' },
  { id: 'bless_fortune', kind: 'blessing', name: 'Blessing of Fortune', icon: 'ic_money',  base: 800, fx: { goldPct: 0.50, dropPct: 0.35 }, floors: BLESSING_FLOORS, desc: '+50% gold & richer loot' },
];
