import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

// CHARACTERIZATION / SAFETY-NET TEST.
//
// The game has no automated tests of its own and silently fails to load if the
// inline <script> has a syntax error. Historically the only guard was "verify
// the JS has no syntax errors by hand". This test automates that: it extracts
// the big inline script from index.html and compiles it with vm.Script, which
// PARSES (never executes) the code and throws SyntaxError on invalid JS.
//
// While the refactor moves code out of index.html into ES modules, this keeps
// the monolith honest at every commit.

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(__dirname, '../../index.html');

function extractInlineScripts(html) {
  // Match every <script>...</script> that is NOT a module/src reference.
  const scripts = [];
  const re = /<script(?![^>]*\bsrc=)(?![^>]*type="module")[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim().length > 0) scripts.push(m[1]);
  }
  return scripts;
}

describe('index.html inline script', () => {
  const html = readFileSync(INDEX, 'utf8');

  it('contains at least one substantial inline script', () => {
    const scripts = extractInlineScripts(html);
    const total = scripts.reduce((n, s) => n + s.length, 0);
    // The game logic is large; if this collapses, something moved unexpectedly.
    expect(total).toBeGreaterThan(1000);
  });

  it('every inline script parses without a syntax error', () => {
    const scripts = extractInlineScripts(html);
    expect(scripts.length).toBeGreaterThan(0);
    for (const [i, code] of scripts.entries()) {
      // vm.Script compiles (parses) but does not run — pure syntax gate.
      expect(
        () => new vm.Script(code, { filename: `index.html#inline-script-${i}` }),
        `inline script #${i} should parse`,
      ).not.toThrow();
    }
  });
});
