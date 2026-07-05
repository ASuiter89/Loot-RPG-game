import { describe, it, expect } from 'vitest';
import { PASSIVE_SURGES } from '../../src/data/passiveSurges.js';

// The stat keys skillBonus()/FX_LABELS understand — a surge must name one of these
// so it folds into an existing combat formula with no new hook.
const KNOWN_FX = new Set([
  'atkFlat', 'dmgDealt', 'dmgTaken', 'maxHpPct', 'maxMpPct', 'hpRegen', 'mpRegen',
  'lifesteal', 'crit', 'critDmg', 'dodge', 'spell', 'manaShield', 'zeal',
  'lowHpDmg', 'reflect', 'pen', 'block', 'dr', 'goldFind', 'magicFind', 'xpGain',
]);

describe('PASSIVE_SURGES data validity', () => {
  const ids = Object.keys(PASSIVE_SURGES);

  it('covers every base-tree passive (25 per class × 4 classes)', () => {
    expect(ids.length).toBe(100);
  });

  it('only touches base-tree passive ids (…_p00–_p44, no keystones _p5x)', () => {
    for (const id of ids) {
      expect(id, `id ${id} shape`).toMatch(/^[wrmt]_p[0-4]\d$/);
    }
  });

  it('grants exactly ONE new stat per node, with a positive magnitude', () => {
    for (const [id, fx] of Object.entries(PASSIVE_SURGES)) {
      const keys = Object.keys(fx);
      expect(keys.length, `surge ${id} grants one stat`).toBe(1);
      const [k] = keys;
      expect(KNOWN_FX.has(k), `surge ${id} stat "${k}" is a known fx key`).toBe(true);
      expect(typeof fx[k], `surge ${id} magnitude type`).toBe('number');
      expect(fx[k], `surge ${id} magnitude positive`).toBeGreaterThan(0);
      expect(Number.isFinite(fx[k]), `surge ${id} magnitude finite`).toBe(true);
    }
  });

  it('has one entry for each of the four classes', () => {
    for (const c of ['w', 'r', 'm', 't']) {
      const n = ids.filter(id => id[0] === c).length;
      expect(n, `class ${c} surge count`).toBe(25);
    }
  });
});
