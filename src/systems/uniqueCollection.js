// Pure helpers behind the Vault's UNIQUE/SET COLLECTION tab — the "one of every
// artifact" showcase. Everything here is deterministic and DOM-free: it turns the
// static unique/set data into an ordered CATALOG of slots, maps the account's
// stored items onto that catalog, and answers the filter queries the grid needs.
// The rendering, tooltips and withdraw wiring live in the legacy layer.
//
// A catalog entry is one authored artifact (a unique, or a single set piece). The
// grid shows one tile per entry: darkened until you've stored a matching item,
// lit (with the best-rolled copy) once you have. Because a stored unique carries
// `item.unique` (its def id) and a set piece carries `item.setPiece`, mapping a
// stored item back to its catalog slot is a pure key lookup — no new save field.

import { UNIQUES } from '../data/uniques.js';
import { ITEM_SETS } from '../data/itemSets.js';
import { setPiecePool } from './itemSets.js';

// Stable catalog key for an authored def. Uniques and set pieces share an id
// namespace only by convention, so the kind prefix keeps them distinct.
export function uniqueCatalogKey(id) { return 'u:' + id; }
export function setCatalogKey(id) { return 's:' + id; }

// The catalog key a STORED item maps onto (or null if it isn't a fixed artifact).
// Set pieces are checked first: a piece carries both `item.set` (the set id) and
// `item.setPiece` (the piece id) — the piece id is what a catalog slot keys on.
export function itemCatalogKey(item) {
  if (!item) return null;
  if (item.setPiece) return setCatalogKey(item.setPiece);
  if (item.unique) return uniqueCatalogKey(item.unique);
  return null;
}

// Build the ordered catalog from the static data. Uniques first (data order), then
// every set piece grouped by set — a stable order the grid can rely on. Each entry
// carries everything a tooltip needs WITHOUT a rolled item: its fixed `native`
// stat, its six `mods`, its signature `power` and flavour.
export function buildCollectionCatalog(uniques = UNIQUES, sets = ITEM_SETS) {
  const out = [];
  for (const d of uniques) {
    out.push({
      key: uniqueCatalogKey(d.id), kind: 'unique', id: d.id,
      name: d.name, base: d.base, slot: d.slot, cls: d.cls,
      native: d.native, mods: d.mods, power: d.power, flavor: d.flavor,
      setId: null, setName: null,
    });
  }
  for (const { setId, piece } of setPiecePool(sets)) {
    const set = sets[setId] || {};
    out.push({
      key: setCatalogKey(piece.id), kind: 'set', id: piece.id,
      name: piece.name, base: piece.base, slot: piece.slot, cls: set.cls,
      native: piece.native, mods: piece.mods, power: piece.power, flavor: piece.flavor,
      setId, setName: set.name || setId,
    });
  }
  return out;
}

// The distinct facets present in a catalog, for building the filter controls:
// the gear slots that appear, and the sets (id + display name), each in first-seen
// order so the UI is stable.
export function collectionFacets(catalog) {
  const slots = [];
  const setSeen = new Map();
  for (const e of catalog) {
    if (e.slot && !slots.includes(e.slot)) slots.push(e.slot);
    if (e.kind === 'set' && !setSeen.has(e.setId)) setSeen.set(e.setId, e.setName);
  }
  return { slots, sets: [...setSeen].map(([id, name]) => ({ id, name })) };
}

// Group the account's stored items by catalog key, best copy first. `items` is the
// raw stash item list; each grouped entry keeps the item's ORIGINAL index so the
// withdraw path (which splices stash.items by index) still works. `powerOf` ranks
// duplicates so the tile always shows your strongest roll; ties fall back to ilvl
// then value so ordering is deterministic.
export function groupStoredArtifacts(items, powerOf = () => 0) {
  const groups = {};
  (items || []).forEach((item, index) => {
    const key = itemCatalogKey(item);
    if (!key) return;
    (groups[key] || (groups[key] = [])).push({ item, index });
  });
  for (const key in groups) {
    groups[key].sort((a, b) =>
      (powerOf(b.item) - powerOf(a.item)) ||
      ((b.item.ilvl || 0) - (a.item.ilvl || 0)) ||
      ((b.item.value || 0) - (a.item.value || 0)));
  }
  return groups;
}

// The set of catalog keys the account has AT LEAST ONE copy of (the "acquired" set,
// which the acquired/missing filter and the completion tally read).
export function acquiredKeySet(groups) {
  const s = new Set();
  for (const key in groups) if (groups[key] && groups[key].length) s.add(key);
  return s;
}

// Filter the catalog down to what the grid should show. All criteria are optional
// (a null/'' value means "any"): `slot` gear slot, `kind` 'unique'|'set',
// `setId` a specific set, and `acquired` true|false to show only owned or only
// missing. `owned` is the acquiredKeySet (only needed when filtering on acquired).
export function filterCatalog(catalog, opts = {}, owned = new Set()) {
  const { slot = null, kind = null, setId = null, acquired = null } = opts;
  return catalog.filter(e => {
    if (slot && e.slot !== slot) return false;
    if (kind && e.kind !== kind) return false;
    if (setId && e.setId !== setId) return false;
    if (acquired === true && !owned.has(e.key)) return false;
    if (acquired === false && owned.has(e.key)) return false;
    return true;
  });
}

// Completion tally for the collection header: how many distinct catalog slots are
// filled out of the total. Pure over the catalog + acquired set.
export function collectionProgress(catalog, owned = new Set()) {
  let have = 0;
  for (const e of catalog) if (owned.has(e.key)) have++;
  return { have, total: catalog.length };
}
