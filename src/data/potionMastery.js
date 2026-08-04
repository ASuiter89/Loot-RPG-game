// ── POTION MASTERY TUNING ──
// The town Healer sells PERMANENT upgrades to the dungeon potions: Potency (each
// sip restores a bigger slice of max HP/MP) and two Recharge tracks — one per
// flask — that shorten how long that flask takes to come back. Levels persist on
// the hero (potionPowerLvl / potionCdHpLvl / potionCdMpLvl); the shell reads
// these numbers rather than embedding them.

// Level caps — Potency tops out lower because each rank is worth more.
export const POTION_POWER_MAX = 5;
export const POTION_CD_MAX = 5;

// Per-rank gains: +5 percentage points of max HP/MP per sip, and −0.4s off that
// flask's recharge. Five Recharge ranks take a flask from 6s to the 4s floor.
export const POTION_PCT_PER_LVL = 0.05;
export const POTION_CD_PER_LVL = 0.4;
export const POTION_CD_MIN = 4;

// Cost curve: base × growth^(ranks already bought). Steep on purpose — a true
// late-game gold sink that competes with Blessings and forge upgrades. Each of
// the three tracks prices independently, so buying one never dearer the others.
export const POTION_UPGRADE_BASE_COST = 9000;
export const POTION_UPGRADE_COST_GROWTH = 2.5;
