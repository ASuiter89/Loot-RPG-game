// ── POTION MASTERY TUNING ──
// The town Healer sells two PERMANENT upgrades to the dungeon potions: Potency
// (each sip restores a bigger slice of max HP/MP) and Recharge (a shorter shared
// cooldown between sips). Levels persist on the hero (potionPowerLvl /
// potionCdLvl); the shell reads these numbers rather than embedding them.

// Level caps — Potency tops out lower because each rank is worth more.
export const POTION_POWER_MAX = 5;
export const POTION_CD_MAX = 6;

// Per-rank gains: +5 percentage points of max HP/MP per sip, −0.5s of cooldown,
// with a hard floor so sips can never become spammable.
export const POTION_PCT_PER_LVL = 0.05;
export const POTION_CD_PER_LVL = 0.5;
export const POTION_CD_MIN = 2;

// Cost curve: base × growth^(ranks already bought). Steep on purpose — a true
// late-game gold sink that competes with Blessings and forge upgrades.
export const POTION_UPGRADE_BASE_COST = 9000;
export const POTION_UPGRADE_COST_GROWTH = 2.5;
