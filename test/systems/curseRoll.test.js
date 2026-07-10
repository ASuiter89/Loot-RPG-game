import { describe, it, expect } from 'vitest';
import {
  CURSE_TIER_MULT,
  curseTierMult,
  statCurseSwing,
  cursedStatCeiling,
  FELT_CURSE_PENALTY_STATS,
  cursePenaltyStats,
} from '../../src/systems/curseRoll.js';

describe('CURSE_TIER_MULT', () => {
  it('ramps from 2.2x (uncommon) to 5x (legendary)', () => {
    expect(CURSE_TIER_MULT.uncommon).toBe(2.2);
    expect(CURSE_TIER_MULT.legendary).toBe(5.0);
    // strictly increasing across the cursable tiers
    expect(CURSE_TIER_MULT.uncommon).toBeLessThan(CURSE_TIER_MULT.rare);
    expect(CURSE_TIER_MULT.rare).toBeLessThan(CURSE_TIER_MULT.epic);
    expect(CURSE_TIER_MULT.epic).toBeLessThan(CURSE_TIER_MULT.legendary);
  });
});

describe('curseTierMult', () => {
  it('returns each cursable tier\'s multiplier', () => {
    expect(curseTierMult('uncommon')).toBe(2.2);
    expect(curseTierMult('rare')).toBe(2.9);
    expect(curseTierMult('epic')).toBe(3.8);
    expect(curseTierMult('legendary')).toBe(5.0);
  });
  it('falls back to the gentlest tier for anything not cursable', () => {
    // junk/normal/unique never actually get cursed, but the fallback must be safe.
    expect(curseTierMult('unique')).toBe(2.2);
    expect(curseTierMult(undefined)).toBe(2.2);
  });
});

describe('statCurseSwing', () => {
  it('is the stat\'s normal ceiling times the tier multiplier', () => {
    expect(statCurseSwing(15, 2.2)).toBe(Math.round(15 * 2.2)); // uncommon ATKSPD
    expect(statCurseSwing(45, 5.0)).toBe(Math.round(45 * 5.0)); // legendary ATKSPD
  });
  it('grows with rarity for the same stat', () => {
    const nm = 30;
    expect(statCurseSwing(nm, curseTierMult('legendary')))
      .toBeGreaterThan(statCurseSwing(nm, curseTierMult('uncommon')));
  });
  it('scales with the stat, so a big-number stat gets a big swing and a small one a small swing', () => {
    expect(statCurseSwing(480, 5)).toBeGreaterThan(statCurseSwing(20, 5));
  });
  it('never drops below 1, even at a zero or negative ceiling', () => {
    expect(statCurseSwing(0, 5)).toBe(1);
    expect(statCurseSwing(-5, 5)).toBe(1);
  });
});

describe('cursedStatCeiling', () => {
  it('is a full normal roll plus one curse swing — the max a cursed stat can reach', () => {
    const nm = 45, cm = 5.0;
    expect(cursedStatCeiling(nm, cm)).toBe(Math.round(nm) + statCurseSwing(nm, cm));
  });
  it('rises with rarity, so a legendary ceiling exceeds an uncommon one', () => {
    const nm = 20;
    expect(cursedStatCeiling(nm, curseTierMult('legendary')))
      .toBeGreaterThan(cursedStatCeiling(nm, curseTierMult('uncommon')));
  });
  it('always exceeds a single swing, so a fresh cursed roll never trips the repair clamp', () => {
    for (const nm of [8, 15, 25, 45, 100, 480]) {
      expect(cursedStatCeiling(nm, 5)).toBeGreaterThan(statCurseSwing(nm, 5));
    }
  });
});

describe('FELT_CURSE_PENALTY_STATS', () => {
  it('is only stats whose NEGATIVE value actually bites (never a floored-at-0 rating)', () => {
    // Core pools that combine with a hero base + the multiplicative damage amps.
    expect(FELT_CURSE_PENALTY_STATS).toEqual(
      expect.arrayContaining(['ATK', 'DEF', 'HP', 'MP', 'SPD', 'IDMG', 'BOSSDMG', 'SPELLPWR', 'SKILLPWR']),
    );
    // Benefit-only ratings that combat floors at 0 must NOT be curse-penalty targets —
    // a negative there is invisible, which is the whole bug this guards against.
    for (const rating of ['CRIT', 'DODGE', 'BLOCK', 'DR', 'PEN', 'LEECH', 'DBLSTRIKE', 'ATKSPD', 'CDR', 'TENAC', 'ACC']) {
      expect(FELT_CURSE_PENALTY_STATS).not.toContain(rating);
    }
  });
});

describe('cursePenaltyStats', () => {
  // A realistic weapon-ish pool: mostly benefit-only ratings, a few felt stats.
  const WEAPON_POOL = ['ATK', 'ACC', 'CRIT', 'CRITDMG', 'IDMG', 'DBLSTRIKE', 'BOSSDMG', 'PEN', 'LEECH', 'ATKSPD', 'SKILLPWR'];

  it('only ever offers FELT stats — never a rating whose negative floors to 0', () => {
    const cands = cursePenaltyStats(WEAPON_POOL, 'CRIT', []);
    expect(cands.length).toBeGreaterThan(0);
    for (const s of cands) expect(FELT_CURSE_PENALTY_STATS).toContain(s);
  });

  it('never returns the boosted stat (the gift and the price are different stats)', () => {
    const cands = cursePenaltyStats(WEAPON_POOL, 'ATK', []);
    expect(cands).not.toContain('ATK');
    expect(cands.length).toBeGreaterThan(0);
  });

  it('prefers a felt stat the item already invests in — degrading a genuine strength', () => {
    // Item already has +IDMG (felt) and +CRIT (a rating). Boost took ATK. The penalty
    // should target the OWNED felt stat (IDMG), not a fresh unrelated one.
    const cands = cursePenaltyStats(WEAPON_POOL, 'ATK', ['IDMG', 'CRIT']);
    expect(cands).toEqual(['IDMG']);
  });

  it('ignores an OWNED stat that is a floored rating (CRIT), falling back to felt pool stats', () => {
    // The only owned stat is CRIT (a floored rating) — not a valid penalty target — so
    // it must fall through to the pool's felt stats rather than curse an invisible one.
    const cands = cursePenaltyStats(WEAPON_POOL, 'ATK', ['CRIT']);
    expect(cands).not.toContain('CRIT');
    for (const s of cands) expect(FELT_CURSE_PENALTY_STATS).toContain(s);
    expect(cands).toEqual(expect.arrayContaining(['IDMG', 'BOSSDMG', 'SKILLPWR']));
  });

  it('falls back to the felt core when the pool has NO felt stat, so a real item is never left uncursable', () => {
    const ratingsOnly = ['CRIT', 'DODGE', 'BLOCK', 'PEN', 'LEECH'];
    const cands = cursePenaltyStats(ratingsOnly, 'CRIT', []);
    expect(cands.length).toBeGreaterThan(0);
    for (const s of cands) expect(FELT_CURSE_PENALTY_STATS).toContain(s);
  });

  it('is empty only for an empty pool with the whole felt core excluded (never in practice)', () => {
    expect(cursePenaltyStats([], null, [])).toEqual(FELT_CURSE_PENALTY_STATS);
    expect(cursePenaltyStats(undefined, null, undefined).length).toBe(FELT_CURSE_PENALTY_STATS.length);
  });
});
