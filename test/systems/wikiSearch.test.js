import { describe, it, expect } from 'vitest';
import {
  stripTags,
  blockText,
  articleBodyText,
  tokenize,
  buildWikiIndex,
  scoreEntry,
  articleSnippet,
  searchWiki,
} from '../../src/systems/wikiSearch.js';
import { WIKI, wikiArticles } from '../../src/data/wiki.js';

describe('stripTags', () => {
  it('returns empty for falsy input', () => {
    expect(stripTags('')).toBe('');
    expect(stripTags(null)).toBe('');
    expect(stripTags(undefined)).toBe('');
  });

  it('removes HTML tags and collapses whitespace', () => {
    expect(stripTags('<b>Hello</b>   <i>world</i>')).toBe('Hello world');
    expect(stripTags('a <span data-spr=ic_fire></span> b')).toBe('a b');
  });

  it('decodes the entities the copy uses', () => {
    expect(stripTags('you&nbsp;&amp;&nbsp;me')).toBe('you & me');
    expect(stripTags('&lt;tag&gt;')).toBe('<tag>');
    expect(stripTags('a&mdash;b')).toBe('a—b');
    expect(stripTags('it&rsquo;s')).toBe("it's");
    expect(stripTags('&ldquo;hi&rdquo;')).toBe('"hi"');
  });
});

describe('blockText', () => {
  it('extracts text from each block kind', () => {
    expect(blockText({ h: 'Head <b>ing</b>' })).toBe('Head ing');
    expect(blockText({ p: 'A <b>para</b>.' })).toBe('A para.');
    expect(blockText({ note: 'A <i>note</i>.' })).toBe('A note.');
    expect(blockText({ ul: ['<b>one</b>', 'two'] })).toBe('one · two');
  });

  it('returns empty for decorative or invalid blocks', () => {
    expect(blockText({ tiers: 1 })).toBe('');
    expect(blockText(null)).toBe('');
    expect(blockText('string')).toBe('');
    expect(blockText({})).toBe('');
  });
});

describe('articleBodyText', () => {
  it('joins all block prose', () => {
    const article = { body: [{ h: 'H' }, { p: 'P' }, { tiers: 1 }, { ul: ['a', 'b'] }] };
    expect(articleBodyText(article)).toBe('H P a · b');
  });

  it('handles missing / non-array body', () => {
    expect(articleBodyText(null)).toBe('');
    expect(articleBodyText({})).toBe('');
    expect(articleBodyText({ body: 'nope' })).toBe('');
  });
});

describe('tokenize', () => {
  it('splits on non-alphanumerics and lowercases', () => {
    expect(tokenize('Auto-Cast SLOT')).toEqual(['auto', 'cast', 'slot']);
    expect(tokenize('  spirit,   veil! ')).toEqual(['spirit', 'veil']);
  });

  it('handles empty / null', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null)).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('buildWikiIndex', () => {
  it('produces one entry per article with lowercased fields', () => {
    const index = buildWikiIndex(WIKI);
    expect(index.length).toBe(wikiArticles(WIKI).length);
    for (const e of index) {
      expect(typeof e.catId).toBe('string');
      expect(e.titleLc).toBe(e.titleLc.toLowerCase());
      expect(Array.isArray(e.keywords)).toBe(true);
      expect(typeof e.bodyLc).toBe('string');
    }
  });

  it('tolerates empty / undefined input', () => {
    expect(buildWikiIndex(undefined)).toEqual([]);
    expect(buildWikiIndex([])).toEqual([]);
    expect(buildWikiIndex([{ id: 'c', title: 'C' }])).toEqual([]); // no articles[]
  });
});

describe('scoreEntry', () => {
  const index = buildWikiIndex([
    {
      id: 'cat', title: 'Combat', icon: 'x',
      articles: [{
        id: 'a', title: 'Critical Hits',
        keywords: ['crit', 'luck'],
        body: [{ p: 'A critical hit deals double damage. Crit crit crit.' }],
      }],
    },
  ]);
  const entry = index[0];

  it('scores a title hit higher than a body-only hit', () => {
    const titleScore = scoreEntry(entry, ['critical'], 'critical');
    const bodyScore = scoreEntry(entry, ['damage'], 'damage');
    expect(titleScore).toBeGreaterThan(bodyScore);
    expect(bodyScore).toBeGreaterThan(0);
  });

  it('rewards an exact keyword match', () => {
    expect(scoreEntry(entry, ['crit'], 'crit')).toBeGreaterThan(0);
  });

  it('requires every term to match (AND semantics)', () => {
    expect(scoreEntry(entry, ['critical', 'zzzznope'], 'critical zzzznope')).toBe(0);
  });

  it('returns 0 with no terms', () => {
    expect(scoreEntry(entry, [], '')).toBe(0);
  });

  it('adds a whole-phrase bonus for a verbatim multi-word title match', () => {
    const withPhrase = scoreEntry(entry, ['critical', 'hits'], 'critical hits');
    const noPhrase = scoreEntry(entry, ['critical', 'hits'], 'hits critical');
    expect(withPhrase).toBeGreaterThan(noPhrase);
  });

  it('counts body frequency but caps the nudge', () => {
    // "crit" appears many times in the body; still a bounded contribution.
    const s = scoreEntry(entry, ['crit'], 'crit');
    expect(s).toBeGreaterThan(0);
    expect(Number.isFinite(s)).toBe(true);
  });
});

describe('articleSnippet', () => {
  it('returns a short body in full', () => {
    const a = { body: [{ p: 'Short line.' }] };
    expect(articleSnippet(a)).toBe('Short line.');
  });

  it('prefers the block containing a search term', () => {
    const a = { body: [{ p: 'First unrelated line.' }, { p: 'Mentions spirit veil here.' }] };
    expect(articleSnippet(a, ['veil'])).toContain('veil');
  });

  it('windows and ellipsises a long block around the match', () => {
    const long = 'x'.repeat(60) + ' NEEDLE ' + 'y'.repeat(200);
    const a = { body: [{ p: long }] };
    const snip = articleSnippet(a, ['needle'], 100);
    expect(snip.length).toBeLessThanOrEqual(102); // maxLen + leading ellipsis
    expect(snip.startsWith('…')).toBe(true);
    expect(snip.endsWith('…')).toBe(true);
    expect(snip.toLowerCase()).toContain('needle');
  });

  it('handles empty / bodyless articles', () => {
    expect(articleSnippet(null)).toBe('');
    expect(articleSnippet({})).toBe('');
    expect(articleSnippet({ body: [{ tiers: 1 }] })).toBe('');
  });

  it('truncates a long first block with no terms', () => {
    const a = { body: [{ p: 'z'.repeat(300) }] };
    const snip = articleSnippet(a, [], 120);
    expect(snip.endsWith('…')).toBe(true);
    expect(snip.length).toBeLessThanOrEqual(121);
  });
});

describe('searchWiki (against the real wiki)', () => {
  it('returns [] for an empty query', () => {
    expect(searchWiki(WIKI, '')).toEqual([]);
    expect(searchWiki(WIKI, '   ')).toEqual([]);
    expect(searchWiki(WIKI, '!!!')).toEqual([]);
  });

  it('finds an article by a title word', () => {
    const res = searchWiki(WIKI, 'spirit veil');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].article.id).toBe('spirit-veil');
    expect(res[0].snippet.length).toBeGreaterThan(0);
  });

  it('finds an article by a keyword synonym not in its prose', () => {
    // "permadeath" is a keyword on the hero-creation article, not in its text.
    const res = searchWiki(WIKI, 'permadeath');
    expect(res.some((r) => r.article.id === 'making-a-hero')).toBe(true);
  });

  it('ranks a title/keyword hit above a mere body mention', () => {
    const res = searchWiki(WIKI, 'auto-cast');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].article.id).toBe('auto-cast');
  });

  it('respects a result limit', () => {
    const res = searchWiki(WIKI, 'the', { limit: 3 });
    expect(res.length).toBeLessThanOrEqual(3);
  });

  it('accepts a prebuilt index', () => {
    const index = buildWikiIndex(WIKI);
    const res = searchWiki(WIKI, 'gambler', { index });
    expect(res.length).toBeGreaterThan(0);
  });

  it('every result carries the fields the UI needs', () => {
    for (const r of searchWiki(WIKI, 'boss')) {
      expect(typeof r.catId).toBe('string');
      expect(typeof r.catTitle).toBe('string');
      expect(typeof r.catIcon).toBe('string');
      expect(r.article && typeof r.article.id).toBe('string');
      expect(typeof r.score).toBe('number');
      expect(typeof r.snippet).toBe('string');
    }
  });
});
