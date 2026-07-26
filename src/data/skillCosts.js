// Skill-cost tuning — what a cast actually CHARGES, in mana or in blood. Pure
// values; the math that reads them lives in src/systems/skillCost.js and the shell
// spends them in castSkillById.
//
// Two prices exist for one skill: its rank-scaled mana number (systems/skillMath.js
// → skillManaCost) and, for a hero who pays in life, the health that number converts
// to. Gear Mana Cost Reduction discounts BOTH, because blood is priced off the
// discounted mana cost.

// A cast never costs less than this, however much Mana Cost Reduction is stacked —
// the price asymptotes toward, but never reaches, free.
export const MIN_CAST_COST = 1;

// A no-mana class (Bloodletter) charges a SHARE OF MAX HP per point of the skill's
// discounted mana cost, so the toll still stings at level 60 the way it did at
// level 5. (The Blood Pact keystone keeps charging the flat mana number as HP, so
// nothing changes for an existing Rogue/Mage/Templar blood-caster.)
export const LIFE_COST_PER_MP = 0.0045;

// Blood Price keystone: double the blood toll.
export const BLOOD_PRICE_MULT = 2;

// Auto-cast SAFETY FLOOR for a blood-caster. A cast paid in life is refused only
// when it would be lethal, which is the right rule for a deliberate keypress — but
// the auto-cast slot fires the instant a skill is ready, so with no floor it bleeds
// a Bloodletter down to a sliver and pins them there for the whole floor. Auto-cast
// therefore keeps this share of max HP in reserve; a MANUAL cast is untouched, so
// the player can still spend down to their last point when they choose to.
export const AUTO_CAST_LIFE_RESERVE = 0.5;
