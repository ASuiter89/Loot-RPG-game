// Skill-tree tier gating: which hero level opens a tree tier. Pure lookups over the
// ladders in data/skillTiers.js — no globals, no state.

import { SKILL_TIER_LEVELS } from '../data/skillTiers.js';

/**
 * Minimum hero level for a tree tier. Tiers past the end of the ladder clamp to its
 * last entry, so a tree that grows a row deeper stays gated rather than free.
 * @param {number} tier node band, 0-based
 * @param {number[]} [ladder] tier→level table (defaults to the base-tree ladder)
 * @returns {number} hero level required (never below 1)
 */
export function tierUnlockLevel(tier, ladder = SKILL_TIER_LEVELS) {
  if (!ladder || !ladder.length) return 1;
  const i = Math.min(Math.max(0, Math.floor(tier || 0)), ladder.length - 1);
  return Math.max(1, ladder[i] || 1);
}

/**
 * Has a hero of this level reached the tier?
 * @param {number} level hero level
 * @param {number} tier node band, 0-based
 * @param {number[]} [ladder] tier→level table
 */
export function tierUnlocked(level, tier, ladder) {
  return (level || 1) >= tierUnlockLevel(tier, ladder);
}
