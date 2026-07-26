import { describe, it, expect } from 'vitest';
import { tenacityTier, resolveEnemyCC, enemyStunImmune } from '../../src/systems/tenacity.js';

const BEAT = 0.4; // WORLD_TICK_SECONDS in production

describe('tenacityTier', () => {
  it('reads boss/elite off the foe, boss winning ties', () => {
    expect(tenacityTier({ isBoss: true })).toBe('boss');
    expect(tenacityTier({ isElite: true })).toBe('elite');
    expect(tenacityTier({ isBoss: true, isElite: true })).toBe('boss');
  });
  it('returns null for ordinary foes and missing input', () => {
    expect(tenacityTier({})).toBe(null);
    expect(tenacityTier({ isGoblin: true })).toBe(null);
    expect(tenacityTier(null)).toBe(null);
    expect(tenacityTier(undefined)).toBe(null);
  });
});

describe('resolveEnemyCC — flat tenacity + diminishing returns', () => {
  it('halves the first stun on a boss (flat tenacity, DR step 1 = full)', () => {
    const r = resolveEnemyCC('boss', { stacks: 0, until: 0 }, 'stun', 3, 0, BEAT);
    expect(r.secs).toBeCloseTo(1.5);       // 3 * (1-0.5) * 1
    expect(r.immune).toBe(false);
    expect(r.dr.stacks).toBe(1);
    expect(r.dr.until).toBe(20);           // 0 + round(8 / 0.4)
  });

  it('diminishes the 2nd hard CC in the window to a fraction', () => {
    const r = resolveEnemyCC('boss', { stacks: 1, until: 20 }, 'stun', 3, 5, BEAT);
    expect(r.secs).toBeCloseTo(0.75);      // 3 * 0.5 * 0.5
    expect(r.immune).toBe(false);
    expect(r.dr.stacks).toBe(2);
    expect(r.dr.until).toBe(25);           // window refreshed from THIS application
  });

  it('shrugs off a stun that DR shrinks below the floor', () => {
    const r = resolveEnemyCC('boss', { stacks: 2, until: 25 }, 'stun', 3, 10, BEAT);
    expect(r.secs).toBe(0);                // 3 * 0.5 * 0.25 = 0.375 < 0.4 floor
    expect(r.immune).toBe(true);
    expect(r.dr.stacks).toBe(3);
  });

  it('lands the 3rd hard CC as a sliver when the base is long enough', () => {
    const r = resolveEnemyCC('boss', { stacks: 2, until: 25 }, 'stun', 4, 10, BEAT);
    expect(r.secs).toBeCloseTo(0.5);       // 4 * 0.5 * 0.25 = 0.5 >= 0.4 floor
    expect(r.immune).toBe(false);
    expect(r.dr.stacks).toBe(3);
  });

  it('is immune once the DR ladder is exhausted', () => {
    const r = resolveEnemyCC('boss', { stacks: 3, until: 30 }, 'stun', 10, 12, BEAT);
    expect(r.secs).toBe(0);                // past the last drStep → factor 0
    expect(r.immune).toBe(true);
    expect(r.dr.stacks).toBe(4);
  });

  it('resets the ladder after a hard-CC-free window', () => {
    const r = resolveEnemyCC('boss', { stacks: 4, until: 30 }, 'stun', 3, 40, BEAT);
    expect(r.secs).toBeCloseTo(1.5);       // stacks reset to 0 → full step again
    expect(r.immune).toBe(false);
    expect(r.dr.stacks).toBe(1);
  });

  it('applies a lighter cut for elites than for bosses', () => {
    const boss = resolveEnemyCC('boss', { stacks: 0, until: 0 }, 'stun', 4, 0, BEAT);
    const elite = resolveEnemyCC('elite', { stacks: 0, until: 0 }, 'stun', 4, 0, BEAT);
    expect(boss.secs).toBeCloseTo(2.0);    // 4 * 0.5
    expect(elite.secs).toBeCloseTo(3.0);   // 4 * 0.75
    expect(elite.secs).toBeGreaterThan(boss.secs);
  });

  it('leaves soft CC (slow/chill) untouched — DR only guards hard locks', () => {
    const dr = { stacks: 0, until: 0 };
    const slow = resolveEnemyCC('boss', dr, 'slow', 3, 0, BEAT);
    expect(slow.secs).toBe(3);
    expect(slow.immune).toBe(false);
    expect(slow.dr).toBe(dr);              // DR state carried through unchanged
    const chill = resolveEnemyCC('boss', dr, 'chill', 5, 0, BEAT);
    expect(chill.secs).toBe(5);
  });

  it('passes through untouched for a foe with no tenacity profile', () => {
    const dr = { stacks: 0, until: 0 };
    const r = resolveEnemyCC(null, dr, 'stun', 3, 0, BEAT);
    expect(r.secs).toBe(3);
    expect(r.immune).toBe(false);
    expect(r.dr).toBe(dr);
  });

  it('tolerates a partial/empty DR state (fresh foe with no fields yet)', () => {
    // stacks missing but the window is live → treated as 0 stacks.
    const a = resolveEnemyCC('boss', { until: 100 }, 'stun', 3, 5, BEAT);
    expect(a.secs).toBeCloseTo(1.5);
    expect(a.dr.stacks).toBe(1);
    // until missing → window counts as lapsed → ladder resets.
    const b = resolveEnemyCC('boss', { stacks: 2 }, 'stun', 3, 5, BEAT);
    expect(b.secs).toBeCloseTo(1.5);
    expect(b.dr.stacks).toBe(1);
  });

  it('cannot be stunlocked: chaining stuns as each expires becomes immune', () => {
    // Re-apply a 2s stun the instant the previous one lapses; prove the chain dies.
    let dr = { stacks: 0, until: 0 };
    let now = 0;
    const landed = [];
    for (let i = 0; i < 6; i++) {
      const r = resolveEnemyCC('boss', dr, 'stun', 2, now, BEAT);
      landed.push(r.secs);
      dr = r.dr;
      now += Math.round((r.secs || 0) / BEAT) + 1; // advance past the stun, restun next beat
    }
    // A few land (shorter each time) then the rest are shrugged — never a full lock.
    expect(landed.some(s => s === 0)).toBe(true);
    const locked = landed.reduce((a, s) => a + s, 0);
    expect(locked).toBeLessThan(2 * 6);   // far less than 6 back-to-back full stuns
  });
});

describe('enemyStunImmune', () => {
  it('is true only when the ladder is exhausted and the window is still live', () => {
    expect(enemyStunImmune('boss', { stacks: 3, until: 20 }, 10)).toBe(true);
    expect(enemyStunImmune('boss', { stacks: 2, until: 20 }, 10)).toBe(false);
  });
  it('is false once the window has lapsed (ladder about to reset)', () => {
    expect(enemyStunImmune('boss', { stacks: 3, until: 20 }, 25)).toBe(false);
  });
  it('is false for a foe with no tenacity profile', () => {
    expect(enemyStunImmune(null, { stacks: 9, until: 999 }, 0)).toBe(false);
  });
  it('tolerates a partial/empty DR state', () => {
    expect(enemyStunImmune('boss', {}, 0)).toBe(false);                 // no until → lapsed
    expect(enemyStunImmune('boss', { until: 100 }, 5)).toBe(false);     // no stacks → 0 < ladder
  });
});
