// ── WIKI SEARCH ──────────────────────────────────────────────────────────────
// Pure search + indexing over the How to Play wiki data (src/data/wiki.js). No
// DOM, no state, no side effects — the DOM layer in src/legacy/game.js renders
// whatever these functions return.
//
// The wiki is small (dozens of short articles), so this is a straightforward
// scored linear scan rather than an inverted index — easy to reason about and
// fast enough to run on every keystroke.

// Strip inline HTML tags and decode the handful of entities the wiki copy uses,
// leaving plain text for indexing / snippets. Deliberately tiny: the wiki only
// ever contains <b>/<i> and <span data-spr=…> icons plus a few named entities.
export function stripTags(html) {
  if (!html) return '';
  return String(html)
    // Drop tags with NO substitute space so inline emphasis (strong<b>er</b> →
    // "stronger") and icons wedged against punctuation don't leave stray gaps.
    // Real word gaps in the copy are ordinary spaces, preserved below.
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&(?:rsquo|lsquo|#39);/g, "'")
    .replace(/&(?:ldquo|rdquo|quot);/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// The plain text of a single body block (heading, paragraph, list, note). The
// decorative tier-chip block carries no prose.
export function blockText(block) {
  if (!block || typeof block !== 'object') return '';
  if (block.h) return stripTags(block.h);
  if (block.p) return stripTags(block.p);
  if (block.note) return stripTags(block.note);
  if (Array.isArray(block.ul)) return block.ul.map(stripTags).join(' · ');
  return '';
}

// All searchable prose of an article's body, joined.
export function articleBodyText(article) {
  if (!article || !Array.isArray(article.body)) return '';
  return article.body.map(blockText).filter(Boolean).join(' ');
}

// Split a query (or any text) into lowercase alphanumeric terms.
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Build a flat, precomputed index over the wiki: one entry per article with its
// searchable text fields lowercased once. The DOM layer can hold onto this so
// keystroke-by-keystroke search never re-strips HTML.
export function buildWikiIndex(wiki) {
  const index = [];
  for (const cat of wiki || []) {
    for (const article of cat.articles || []) {
      const titleLc = String(article.title || '').toLowerCase();
      const keywords = (article.keywords || []).map((k) => String(k).toLowerCase());
      const bodyLc = articleBodyText(article).toLowerCase();
      index.push({
        catId: cat.id,
        catTitle: cat.title,
        catIcon: cat.icon,
        article,
        titleLc,
        keywords,
        keywordsLc: keywords.join(' '),
        catTitleLc: String(cat.title || '').toLowerCase(),
        bodyLc,
      });
    }
  }
  return index;
}

// Count non-overlapping occurrences of `needle` in `hay` (both lowercased).
function countOccurrences(hay, needle) {
  if (!hay || !needle) return 0;
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    n++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

// Score one index entry against the tokenized query terms. Returns 0 unless
// EVERY term is found somewhere in the article (AND semantics), so multi-word
// queries narrow rather than widen. Weights favour title > keyword > category >
// body, with a small frequency nudge and a whole-phrase bonus.
export function scoreEntry(entry, terms, phrase) {
  if (!terms.length) return 0;
  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    if (entry.titleLc.includes(term)) {
      termScore += 10;
      if (entry.titleLc === term || entry.titleLc.startsWith(term + ' ')) termScore += 6;
    }
    for (const kw of entry.keywords) {
      if (kw === term) { termScore += 8; break; }
      if (kw.includes(term)) { termScore += 5; break; }
    }
    if (entry.catTitleLc.includes(term)) termScore += 3;
    const bodyHits = countOccurrences(entry.bodyLc, term);
    if (bodyHits) termScore += 1 + Math.min(bodyHits - 1, 3) * 0.5;
    if (termScore === 0) return 0; // this term matched nothing → whole article out
    score += termScore;
  }
  // Whole-phrase bonus for multi-word queries that appear verbatim.
  if (phrase && phrase.includes(' ')) {
    if (entry.titleLc.includes(phrase)) score += 20;
    else if (entry.bodyLc.includes(phrase)) score += 4;
  }
  return score;
}

// A short plain-text snippet from an article, preferring a block that mentions
// one of the search terms, and centred on the first match so the hit is visible.
export function articleSnippet(article, terms = [], maxLen = 150) {
  const texts = (article && Array.isArray(article.body) ? article.body : [])
    .map(blockText)
    .filter(Boolean);
  if (!texts.length) return '';
  let chosen = texts[0];
  let at = -1;
  if (terms.length) {
    outer:
    for (const t of texts) {
      const lc = t.toLowerCase();
      for (const term of terms) {
        const i = lc.indexOf(term);
        if (i !== -1) { chosen = t; at = i; break outer; }
      }
    }
  }
  if (chosen.length <= maxLen) return chosen;
  // Window the snippet around the first match (or the start).
  let start = 0;
  if (at > 40) start = at - 40;
  let snippet = chosen.slice(start, start + maxLen).trim();
  if (start > 0) snippet = '…' + snippet;
  if (start + maxLen < chosen.length) snippet = snippet + '…';
  return snippet;
}

// Search the wiki. Returns ranked matches, most relevant first:
//   [{ catId, catTitle, catIcon, article, score, snippet }]
// An empty/whitespace query returns []. Pass a prebuilt index (buildWikiIndex)
// to avoid re-indexing on every call; otherwise it's built on the fly.
export function searchWiki(wiki, query, opts = {}) {
  const phrase = String(query || '').toLowerCase().trim();
  const terms = tokenize(query);
  if (!terms.length) return [];
  const index = opts.index || buildWikiIndex(wiki);
  const limit = opts.limit || Infinity;
  const results = [];
  for (const entry of index) {
    const score = scoreEntry(entry, terms, phrase);
    if (score > 0) {
      results.push({
        catId: entry.catId,
        catTitle: entry.catTitle,
        catIcon: entry.catIcon,
        article: entry.article,
        score,
        snippet: articleSnippet(entry.article, terms),
      });
    }
  }
  // Highest score first; ties keep the wiki's authored order (stable sort).
  results.sort((a, b) => b.score - a.score);
  return limit === Infinity ? results : results.slice(0, limit);
}
