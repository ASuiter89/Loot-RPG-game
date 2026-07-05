import { describe, it, expect } from 'vitest';
import { UNIQUES } from '../../src/data/uniques.js';
import { ITEM_SETS } from '../../src/data/itemSets.js';
import { setPiecePool } from '../../src/systems/itemSets.js';
import {
  uniqueCatalogKey, setCatalogKey, itemCatalogKey, buildCollectionCatalog,
  collectionFacets, groupStoredArtifacts, acquiredKeySet, filterCatalog,
  collectionProgress,
} from '../../src/systems/uniqueCollection.js';

describe('uniqueCollection catalog', () => {
  const catalog = buildCollectionCatalog();

  it('covers every unique and every set piece exactly once', () => {
    const pieceCount = setPiecePool(ITEM_SETS).length;
    expect(catalog.length).toBe(UNIQUES.length + pieceCount);
    expect(catalog.filter(e => e.kind === 'unique').length).toBe(UNIQUES.length);
    expect(catalog.filter(e => e.kind === 'set').length).toBe(pieceCount);
  });

  it('gives every entry a unique key and carries the fixed def payload', () => {
    const keys = new Set(catalog.map(e => e.key));
    expect(keys.size).toBe(catalog.length);
    for (const e of catalog) {
      expect(e.name).toBeTruthy();
      expect(e.slot).toBeTruthy();
      expect(e.native).toBeTruthy();
      expect(Array.isArray(e.mods)).toBe(true);
      expect(e.mods.length).toBe(6);
      expect(e.power).toBeTruthy();
      if (e.kind === 'set') { expect(e.setId).toBeTruthy(); expect(e.setName).toBeTruthy(); }
      else { expect(e.setId).toBeNull(); }
    }
  });

  it('keys stored items back onto their catalog slot', () => {
    const u = UNIQUES[0];
    expect(itemCatalogKey({ unique: u.id, fixed: true })).toBe(uniqueCatalogKey(u.id));
    const sp = setPiecePool(ITEM_SETS)[0];
    expect(itemCatalogKey({ set: sp.setId, setPiece: sp.piece.id, fixed: true }))
      .toBe(setCatalogKey(sp.piece.id));
    expect(itemCatalogKey({ tier: 'rare' })).toBeNull();
    expect(itemCatalogKey(null)).toBeNull();
  });

  it('a set piece keys on the piece id even though it also carries a set id', () => {
    const sp = setPiecePool(ITEM_SETS)[0];
    // setPiece wins over unique when (defensively) both are present.
    expect(itemCatalogKey({ set: sp.setId, setPiece: sp.piece.id, unique: 'nope' }))
      .toBe(setCatalogKey(sp.piece.id));
  });
});

describe('uniqueCollection facets', () => {
  const catalog = buildCollectionCatalog();
  it('lists the slots and sets present', () => {
    const f = collectionFacets(catalog);
    expect(f.slots).toContain('weapon');
    expect(f.slots.length).toBeGreaterThan(1);
    expect(f.sets.length).toBe(Object.keys(ITEM_SETS).length);
    for (const s of f.sets) { expect(s.id).toBeTruthy(); expect(s.name).toBeTruthy(); }
  });
});

describe('uniqueCollection grouping', () => {
  const u = UNIQUES[0];
  const key = uniqueCatalogKey(u.id);
  const mk = (power, extra = {}) => ({ unique: u.id, fixed: true, power, ...extra });

  it('groups duplicates and sorts the best roll first', () => {
    const items = [mk(10), { tier: 'rare' }, mk(30), mk(20)];
    const groups = groupStoredArtifacts(items, it => it.power || 0);
    expect(groups[key].length).toBe(3);
    // best-first by power
    expect(groups[key].map(g => g.item.power)).toEqual([30, 20, 10]);
    // original indices preserved (rare item at 1 is skipped)
    expect(groups[key][0].index).toBe(2);
  });

  it('breaks power ties by ilvl then value', () => {
    const items = [mk(10, { ilvl: 5, value: 100 }), mk(10, { ilvl: 9, value: 50 }), mk(10, { ilvl: 5, value: 300 })];
    const groups = groupStoredArtifacts(items, it => it.power || 0);
    expect(groups[key].map(g => g.item.ilvl)).toEqual([9, 5, 5]);
    expect(groups[key][1].item.value).toBe(300); // higher value wins the ilvl tie
  });

  it('ignores non-artifact items entirely', () => {
    const groups = groupStoredArtifacts([{ tier: 'rare' }, { tier: 'epic' }]);
    expect(Object.keys(groups).length).toBe(0);
  });

  it('acquiredKeySet reflects only keys with a stored copy', () => {
    const groups = groupStoredArtifacts([mk(10)], it => it.power || 0);
    const owned = acquiredKeySet(groups);
    expect(owned.has(key)).toBe(true);
    expect(owned.size).toBe(1);
  });
});

describe('uniqueCollection filtering', () => {
  const catalog = buildCollectionCatalog();
  const someSet = collectionFacets(catalog).sets[0];

  it('filters by slot, kind and set', () => {
    expect(filterCatalog(catalog, { slot: 'weapon' }).every(e => e.slot === 'weapon')).toBe(true);
    expect(filterCatalog(catalog, { kind: 'unique' }).every(e => e.kind === 'unique')).toBe(true);
    const bySet = filterCatalog(catalog, { setId: someSet.id });
    expect(bySet.length).toBeGreaterThan(0);
    expect(bySet.every(e => e.setId === someSet.id)).toBe(true);
  });

  it('filters by acquired / missing against the owned set', () => {
    const owned = new Set([catalog[0].key]);
    expect(filterCatalog(catalog, { acquired: true }, owned)).toEqual([catalog[0]]);
    const missing = filterCatalog(catalog, { acquired: false }, owned);
    expect(missing.length).toBe(catalog.length - 1);
    expect(missing.some(e => e.key === catalog[0].key)).toBe(false);
  });

  it('combines criteria (AND semantics)', () => {
    const out = filterCatalog(catalog, { kind: 'set', setId: someSet.id });
    expect(out.every(e => e.kind === 'set' && e.setId === someSet.id)).toBe(true);
  });
});

describe('uniqueCollection progress', () => {
  it('counts filled slots out of the total', () => {
    const catalog = buildCollectionCatalog();
    const owned = new Set([catalog[0].key, catalog[1].key]);
    expect(collectionProgress(catalog, owned)).toEqual({ have: 2, total: catalog.length });
  });
});

describe('uniqueCollection edge cases', () => {
  it('falls back to setId + empty defaults for a nameless/cls-less set', () => {
    const sets = { mystery: { pieces: [{ id: 'mp', base: 'Ring', slot: 'ring', name: 'Mote', native: 'HP', mods: [], power: 'stalwart', flavor: 'f' }] } };
    const cat = buildCollectionCatalog([], sets);
    expect(cat).toHaveLength(1);
    expect(cat[0].setName).toBe('mystery'); // no set.name → id fallback
    expect(cat[0].cls).toBeUndefined();
  });

  it('groups with the default powerOf (ranks purely by ilvl then value)', () => {
    const items = [
      { unique: 'x', ilvl: 3, value: 10 },
      { unique: 'x', ilvl: 8, value: 10 },
    ];
    const groups = groupStoredArtifacts(items); // no powerOf passed
    expect(groups['u:x'].map(g => g.item.ilvl)).toEqual([8, 3]);
  });

  it('acquiredKeySet skips keys whose stored list is empty', () => {
    const owned = acquiredKeySet({ 'u:a': [], 'u:b': [{ item: {}, index: 0 }] });
    expect(owned.has('u:a')).toBe(false);
    expect(owned.has('u:b')).toBe(true);
  });
});
