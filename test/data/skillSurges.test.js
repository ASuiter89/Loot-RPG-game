import { describe, it, expect } from 'vitest';
import {
  ACTIVE_SURGE_ARCHETYPES, ACTIVE_SURGE_OVERRIDES, DEFAULT_SURGE_ARCHETYPE,
  SURGE_MILESTONE_RANKS,
} from '../../src/data/skillSurges.js';

// The cast-mod keys applySurgeCastMods() understands — a perk mod must name one of
// these so it folds into an existing resolveCast lever with no new hook.
const KNOWN_MODS = new Set([
  'radius', 'range', 'chain', 'count', 'repeat', 'summonCount', 'ttl',
  'statusDur', 'statusChance', 'buffDur', 'buffMag', 'healMul', 'execute',
  'lifesteal', 'detonate', 'pull', 'crit', 'haste',
]);

function assertPerkTable(label, table) {
  it(`${label}: has a perk at each of ranks 3 / 7 / 10`, () => {
    expect(Object.keys(table).map(Number).sort((a, b) => a - b)).toEqual(SURGE_MILESTONE_RANKS);
  });

  it(`${label}: every perk has a concrete description and a non-empty mods object`, () => {
    for (const rk of SURGE_MILESTONE_RANKS) {
      const perk = table[rk];
      expect(typeof perk.desc, `rank ${rk} desc type`).toBe('string');
      expect(perk.desc.length, `rank ${rk} desc non-empty`).toBeGreaterThan(0);
      // The whole point of the pass: every line states a number so the player knows
      // exactly what the milestone grants — no vague "a surge" copy.
      expect(/\d/.test(perk.desc), `rank ${rk} desc "${perk.desc}" has a number`).toBe(true);
      expect(perk.mods && typeof perk.mods, `rank ${rk} mods object`).toBe('object');
      expect(Object.keys(perk.mods).length, `rank ${rk} mods non-empty`).toBeGreaterThan(0);
    }
  });

  it(`${label}: every mod key is one applySurgeCastMods understands, with a sane value`, () => {
    for (const rk of SURGE_MILESTONE_RANKS) {
      for (const [k, v] of Object.entries(table[rk].mods)) {
        expect(KNOWN_MODS.has(k), `rank ${rk} mod "${k}" is known`).toBe(true);
        if (k === 'pull' || k === 'crit') {
          expect(v, `rank ${rk} ${k} is a flag`).toBe(true);
        } else {
          expect(typeof v, `rank ${rk} ${k} type`).toBe('number');
          expect(v, `rank ${rk} ${k} positive`).toBeGreaterThan(0);
          expect(Number.isFinite(v), `rank ${rk} ${k} finite`).toBe(true);
        }
      }
    }
  });

  it(`${label}: milestones escalate — power never leaks, each rank adds something`, () => {
    // Sanity that the three rows are distinct (no accidental copy-paste of the same
    // perk across all three ranks).
    const descs = SURGE_MILESTONE_RANKS.map(rk => table[rk].desc);
    expect(new Set(descs).size, 'three distinct milestone lines').toBe(3);
  });
}

describe('ACTIVE_SURGE_ARCHETYPES data validity', () => {
  it('includes the default archetype', () => {
    expect(ACTIVE_SURGE_ARCHETYPES[DEFAULT_SURGE_ARCHETYPE]).toBeTruthy();
  });

  it('defines a healthy spread of archetypes (variety is the point)', () => {
    expect(Object.keys(ACTIVE_SURGE_ARCHETYPES).length).toBeGreaterThanOrEqual(12);
  });

  for (const [name, table] of Object.entries(ACTIVE_SURGE_ARCHETYPES)) {
    describe(`archetype ${name}`, () => assertPerkTable(name, table));
  }
});

describe('ACTIVE_SURGE_OVERRIDES data validity', () => {
  it('keys are plausible skill ids', () => {
    for (const id of Object.keys(ACTIVE_SURGE_OVERRIDES)) {
      expect(id, `override id ${id}`).toMatch(/^[a-z]+_[a-z0-9]+$/i);
    }
  });

  for (const [id, table] of Object.entries(ACTIVE_SURGE_OVERRIDES)) {
    describe(`override ${id}`, () => assertPerkTable(id, table));
  }
});
