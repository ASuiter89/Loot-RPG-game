import { describe, it, expect } from 'vitest';
import { DEEDS } from '../../src/data/deeds.js';

// Kinds the systems reader knows how to map — a deed using anything else would
// silently never complete, so pin the catalog to this set.
const KNOWN_KINDS = new Set([
  'collectionHave', 'bestiaryDiscovered', 'diffCleared', 'maxFloor', 'endlessFloor',
  'bountyTotal', 'classesPlayed', 'setsCompleted', 'mirrored',
]);
const KNOWN_CATEGORIES = new Set([
  'collection', 'bestiary', 'conquest', 'depth', 'bounty', 'breadth', 'mastery',
]);

describe('DEEDS data shape', () => {
  it('is a healthy catalog (~36 deeds)', () => {
    expect(Array.isArray(DEEDS)).toBe(true);
    expect(DEEDS.length).toBeGreaterThanOrEqual(30);
  });

  it('gives every deed a unique id', () => {
    const ids = new Set();
    for (const d of DEEDS) {
      expect(typeof d.id).toBe('string');
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);
    }
  });

  it('gives every deed a well-formed, known requirement and metadata', () => {
    for (const d of DEEDS) {
      expect(KNOWN_CATEGORIES.has(d.category), `${d.id} category`).toBe(true);
      expect(typeof d.name).toBe('string');
      expect(d.name.length).toBeGreaterThan(0);
      expect(typeof d.desc).toBe('string');
      expect(d.desc.length).toBeGreaterThan(0);
      expect(typeof d.sprite).toBe('string');
      expect(d.sprite.length).toBeGreaterThan(0);
      expect(d.requirement, d.id).toBeTruthy();
      expect(KNOWN_KINDS.has(d.requirement.kind), `${d.id} kind`).toBe(true);
      expect(Number.isInteger(d.requirement.threshold)).toBe(true);
      expect(d.requirement.threshold).toBeGreaterThan(0);
      expect(Number.isInteger(d.renown)).toBe(true);
      expect(d.renown).toBeGreaterThan(0);
    }
  });

  it('is front-loaded — at least one deed clears at a tiny threshold', () => {
    const easy = DEEDS.filter((d) => d.requirement.threshold <= 2);
    expect(easy.length).toBeGreaterThan(0);
  });

  it('has a genuine long tail — deep capstones worth the most renown', () => {
    const maxRenown = Math.max(...DEEDS.map((d) => d.renown));
    expect(maxRenown).toBeGreaterThanOrEqual(700);
  });

  it('covers every deed category', () => {
    const seen = new Set(DEEDS.map((d) => d.category));
    for (const c of KNOWN_CATEGORIES) expect(seen.has(c), c).toBe(true);
  });

  it('within a requirement kind, thresholds and renown climb together', () => {
    const byKind = {};
    for (const d of DEEDS) (byKind[d.requirement.kind] ||= []).push(d);
    for (const kind in byKind) {
      const sorted = byKind[kind].slice().sort((a, b) => a.requirement.threshold - b.requirement.threshold);
      for (let i = 1; i < sorted.length; i++) {
        // Steeper threshold ⇒ at least as much renown (bigger goals never pay less).
        expect(sorted[i].renown).toBeGreaterThanOrEqual(sorted[i - 1].renown);
      }
    }
  });
});
