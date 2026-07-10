import { describe, it, expect } from 'vitest';
import { WIKI, wikiArticles } from '../../src/data/wiki.js';
import { blockText } from '../../src/systems/wikiSearch.js';

describe('WIKI data validity', () => {
  it('is a non-empty array of categories', () => {
    expect(Array.isArray(WIKI)).toBe(true);
    expect(WIKI.length).toBeGreaterThan(5);
  });

  it('every category has { id, title, icon, blurb, articles[] }', () => {
    for (const [i, cat] of WIKI.entries()) {
      expect(typeof cat.id, `category ${i} id`).toBe('string');
      expect(cat.id, `category ${i} id non-empty`).not.toBe('');
      expect(typeof cat.title, `category ${i} title`).toBe('string');
      expect(typeof cat.icon, `category ${i} icon`).toBe('string');
      expect(cat.icon, `category ${i} icon non-empty`).not.toBe('');
      expect(typeof cat.blurb, `category ${i} blurb`).toBe('string');
      expect(Array.isArray(cat.articles), `category ${i} articles`).toBe(true);
      expect(cat.articles.length, `category ${i} has articles`).toBeGreaterThan(0);
    }
  });

  it('category icons look like sprite keys (not emoji)', () => {
    // Sprite atlas keys are lowercase snake_case ids; the pixel-art rule forbids
    // emoji standing in for real icons.
    for (const cat of WIKI) {
      expect(cat.icon, `${cat.id} icon`).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('every article has { id, title, keywords[], body[] }', () => {
    for (const cat of WIKI) {
      for (const [j, a] of cat.articles.entries()) {
        const where = `${cat.id}/${j}`;
        expect(typeof a.id, `${where} id`).toBe('string');
        expect(a.id, `${where} id non-empty`).not.toBe('');
        expect(typeof a.title, `${where} title`).toBe('string');
        expect(Array.isArray(a.keywords), `${where} keywords`).toBe(true);
        expect(a.keywords.length, `${where} keywords non-empty`).toBeGreaterThan(0);
        for (const k of a.keywords) expect(typeof k, `${where} keyword`).toBe('string');
        expect(Array.isArray(a.body), `${where} body`).toBe(true);
        expect(a.body.length, `${where} body non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('every body block is a recognised shape with real content', () => {
    for (const cat of WIKI) {
      for (const a of cat.articles) {
        for (const [k, block] of a.body.entries()) {
          const where = `${cat.id}/${a.id}/block${k}`;
          const kind = block.h != null ? 'h'
            : block.p != null ? 'p'
            : block.note != null ? 'note'
            : Array.isArray(block.ul) ? 'ul'
            : block.tiers ? 'tiers'
            : null;
          expect(kind, `${where} is a known block kind`).not.toBeNull();
          if (kind === 'ul') {
            expect(block.ul.length, `${where} list non-empty`).toBeGreaterThan(0);
            for (const li of block.ul) expect(typeof li).toBe('string');
          } else if (kind !== 'tiers') {
            expect(blockText(block).length, `${where} has text`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('article ids are globally unique', () => {
    const ids = [];
    for (const cat of WIKI) for (const a of cat.articles) ids.push(a.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `duplicate article ids: ${dupes.join(', ')}`).toEqual([]);
  });

  it('category ids are unique', () => {
    const ids = WIKI.map((c) => c.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `duplicate category ids: ${dupes.join(', ')}`).toEqual([]);
  });

  it('never references another game (player-facing copy stands on its own)', () => {
    // Mirrors the CHANGELOG rule: wiki copy must not lean on another title for
    // meaning. Scan every scrap of prose.
    const forbidden = /\b(diablo|golden sun|roguelike|rogue-like|path of exile|torchlight|elden ring)\b/i;
    const offenders = [];
    for (const cat of WIKI) {
      for (const a of cat.articles) {
        const texts = [a.title, ...a.keywords, ...a.body.map(blockText)];
        for (const t of texts) if (forbidden.test(t)) offenders.push(`${a.id}: ${t}`);
      }
    }
    expect(offenders, `wiki references another game:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('wikiArticles', () => {
  it('flattens every article with its category context', () => {
    const flat = wikiArticles(WIKI);
    const total = WIKI.reduce((n, c) => n + c.articles.length, 0);
    expect(flat.length).toBe(total);
    for (const e of flat) {
      expect(typeof e.catId).toBe('string');
      expect(typeof e.catTitle).toBe('string');
      expect(typeof e.catIcon).toBe('string');
      expect(e.article && typeof e.article.id).toBe('string');
    }
  });

  it('defaults to the real WIKI when called with no argument', () => {
    expect(wikiArticles().length).toBe(wikiArticles(WIKI).length);
  });
});
