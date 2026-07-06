import { describe, it, expect } from 'vitest';
import { PANTHEON, PANTHEON_SHARDS } from '../../src/data/pinnacle.js';
import { allPinnacleUniqueIds } from '../../src/data/pinnacleUniques.js';

const KINDS = new Set(['disc', 'ring', 'lane', 'cone']);
const MYTHIC_IDS = new Set(allPinnacleUniqueIds());

describe('PANTHEON roster shape', () => {
  it('holds 6 base gods + 6 uber variants (12 total)', () => {
    expect(Array.isArray(PANTHEON)).toBe(true);
    const base = PANTHEON.filter((b) => b.tier === 'base');
    const uber = PANTHEON.filter((b) => b.tier === 'uber');
    expect(base).toHaveLength(6);
    expect(uber).toHaveLength(6);
    expect(PANTHEON).toHaveLength(12);
  });

  it('ids are unique', () => {
    const ids = PANTHEON.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every god has the required top-level fields', () => {
    for (const b of PANTHEON) {
      expect(typeof b.id).toBe('string');
      expect(typeof b.name).toBe('string');
      expect(typeof b.atlasKey).toBe('string');
      expect(b.tier === 'base' || b.tier === 'uber').toBe(true);
      expect(b.arena && b.arena.w > 0 && b.arena.h > 0).toBe(true);
      expect(b.hp && b.hp.mult > 0).toBe(true);
      expect(Number.isInteger(b.bossPointPayout) && b.bossPointPayout > 0).toBe(true);
      expect(b.firstClearBonus && typeof b.firstClearBonus === 'object').toBe(true);
    }
  });

  it('summon recipes reference a known shard family with a positive count + gold', () => {
    const shardTypes = new Set(Object.values(PANTHEON_SHARDS));
    for (const b of PANTHEON) {
      expect(b.summon && typeof b.summon === 'object').toBe(true);
      expect(b.summon.gold).toBeGreaterThan(0);
      expect(shardTypes.has(b.summon.shards.type)).toBe(true);
      expect(b.summon.shards.count).toBeGreaterThan(0);
      if (b.summon.chaos !== undefined) expect(b.summon.chaos).toBeGreaterThan(0);
    }
  });

  it('each base god has exactly one uber pointing back at it, gated on Endless depth', () => {
    const bases = PANTHEON.filter((b) => b.tier === 'base');
    for (const base of bases) {
      const ubers = PANTHEON.filter((b) => b.tier === 'uber' && b.uberOf === base.id);
      expect(ubers).toHaveLength(1);
      const uber = ubers[0];
      expect(uber.uberMinEndlessDepth).toBeGreaterThan(0);
      // Ubers are strictly the harder, richer form.
      expect(uber.hp.mult).toBeGreaterThan(base.hp.mult);
      expect(uber.bossPointPayout).toBeGreaterThan(base.bossPointPayout);
      expect(uber.summon.shards.count).toBeGreaterThan(base.summon.shards.count);
    }
    // Base gods never gate.
    for (const base of bases) {
      expect(base.uberOf).toBe(null);
      expect(base.uberMinEndlessDepth).toBe(0);
    }
  });

  it('phases are authored high→low with valid telegraphs and the first at full HP', () => {
    for (const b of PANTHEON) {
      expect(Array.isArray(b.phases)).toBe(true);
      expect(b.phases.length).toBeGreaterThanOrEqual(3);
      expect(b.phases[0].atHpFrac).toBe(1.0);
      let prev = Infinity;
      for (const ph of b.phases) {
        expect(typeof ph.id).toBe('string');
        expect(ph.atHpFrac).toBeGreaterThan(0);
        expect(ph.atHpFrac).toBeLessThanOrEqual(1);
        // strictly descending entry thresholds
        expect(ph.atHpFrac).toBeLessThan(prev);
        prev = ph.atHpFrac;
        expect(Array.isArray(ph.telegraphs)).toBe(true);
        expect(ph.telegraphs.length).toBeGreaterThan(0);
        for (const t of ph.telegraphs) {
          expect(typeof t.id).toBe('string');
          expect(KINDS.has(t.kind)).toBe(true);
          expect(t.windupSec).toBeGreaterThan(0);
          expect(t.damageMult).toBeGreaterThan(0);
        }
        if (ph.addWave) {
          expect(ph.addWave.count).toBeGreaterThan(0);
          expect(ph.addWave.everySec).toBeGreaterThan(0);
        }
        if (ph.enrageAtSec !== undefined) expect(ph.enrageAtSec).toBeGreaterThan(0);
      }
    }
  });

  it('the roster shows a real difficulty staircase (Umbriel is the toughest base)', () => {
    const umbriel = PANTHEON.find((b) => b.id === 'umbriel');
    const otherBases = PANTHEON.filter((b) => b.tier === 'base' && b.id !== 'umbriel');
    // The graduation exam has the most phases of any base.
    for (const b of otherBases) {
      expect(umbriel.phases.length).toBeGreaterThanOrEqual(b.phases.length);
    }
  });

  it('every loot pool id resolves to a real Mythic unique, with a sane pity + dropChance', () => {
    for (const b of PANTHEON) {
      expect(Array.isArray(b.loot.pool)).toBe(true);
      expect(b.loot.pool.length).toBeGreaterThan(0);
      for (const id of b.loot.pool) expect(MYTHIC_IDS.has(id)).toBe(true);
      expect(Number.isInteger(b.loot.pityThreshold)).toBe(true);
      expect(b.loot.pityThreshold).toBeGreaterThan(0);
      expect(b.loot.dropChance).toBeGreaterThan(0);
      expect(b.loot.dropChance).toBeLessThanOrEqual(1);
    }
  });
});
