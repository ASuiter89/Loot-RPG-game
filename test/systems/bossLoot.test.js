import { describe, it, expect } from 'vitest';
import { KILL_LOOT, killLootClass, killLootParams } from '../../src/systems/bossLoot.js';

describe('killLootClass', () => {
  it('classifies bosses, elites and ordinary foes', () => {
    expect(killLootClass({ isBoss: true })).toBe('boss');
    expect(killLootClass({ isElite: true })).toBe('elite');
    expect(killLootClass({ type: 'rat' })).toBe('normal');
  });

  it('prefers boss over elite when both flags are set', () => {
    expect(killLootClass({ isBoss: true, isElite: true })).toBe('boss');
  });

  it('is safe on a missing foe', () => {
    expect(killLootClass(null)).toBe('normal');
    expect(killLootClass(undefined)).toBe('normal');
  });
});

describe('killLootParams — ordinary kills', () => {
  it('returns the plain per-tier numbers for a boss (no first kill)', () => {
    expect(killLootParams({ isBoss: true })).toEqual({
      firstKill: false, picks: 5, noDrop: 0.608, quality: 3,
    });
  });

  it('returns the plain per-tier numbers for an elite', () => {
    expect(killLootParams({ isElite: true })).toEqual({
      firstKill: false, picks: 3, noDrop: 0.748, quality: 2,
    });
  });

  it('returns the plain per-tier numbers for an ordinary foe', () => {
    expect(killLootParams({ type: 'rat' })).toEqual({
      firstKill: false, picks: 1, noDrop: 0.944, quality: 1,
    });
  });
});

describe('killLootParams — first-kill jackpot', () => {
  it('pays a windfall on a boss first kill: ~2x picks, +quality, slashed noDrop', () => {
    const p = killLootParams({ isBoss: true, firstKill: true });
    expect(p.firstKill).toBe(true);
    expect(p.picks).toBe(10);                 // 5 * 2
    expect(p.quality).toBe(6);                // 3 + 3
    expect(p.noDrop).toBeCloseTo(0.608 * 0.35, 10);
    // A first kill drops strictly more, and more often, than a farmed re-kill.
    const farmed = killLootParams({ isBoss: true, firstKill: false });
    expect(p.picks).toBeGreaterThan(farmed.picks);
    expect(p.quality).toBeGreaterThan(farmed.quality);
    expect(p.noDrop).toBeLessThan(farmed.noDrop);
  });

  it('does NOT grant the jackpot to elites or ordinary foes even if flagged', () => {
    expect(killLootParams({ isElite: true, firstKill: true }).firstKill).toBe(false);
    expect(killLootParams({ isElite: true, firstKill: true }).picks).toBe(3);
    expect(killLootParams({ firstKill: true }).firstKill).toBe(false);
    expect(killLootParams({ firstKill: true }).picks).toBe(1);
  });

  it('never drops below one pick, even with an aggressive tuning', () => {
    const tuning = { ...KILL_LOOT, firstKill: { lootMult: 0, qualityBonus: 0, noDropMult: 1 } };
    expect(killLootParams({ isBoss: true, firstKill: true }, tuning).picks).toBe(1);
  });

  it('honours a custom tuning object', () => {
    const tuning = {
      boss: { picks: 4, noDrop: 0.5, quality: 2 },
      elite: { picks: 2, noDrop: 0.6, quality: 1 },
      normal: { picks: 1, noDrop: 0.9, quality: 0 },
      firstKill: { lootMult: 2, qualityBonus: 5, noDropMult: 0.5 },
    };
    const p = killLootParams({ isBoss: true, firstKill: true }, tuning);
    expect(p.picks).toBe(8);        // 4 * 2
    expect(p.quality).toBe(7);      // 2 + 5
    expect(p.noDrop).toBeCloseTo(0.25, 10); // 0.5 * 0.5
  });
});
