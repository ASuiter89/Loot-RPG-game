// @vitest-environment node
//
// (node, not the suite's default jsdom: esbuild's API asserts that TextEncoder
// yields a real Node Uint8Array, which jsdom's globals break.)
//
// Guard: no object literal anywhere in src/ may declare the same key twice.
//
// A duplicate key is legal JavaScript and silently discards the earlier entry, so it
// never throws and never shows up in a behaviour test — the later row just quietly
// wins. It cost us a live one: src/data/enemyDefense.js listed `deathknight` twice
// (the deep-roster mob and the boss share one type key), so the mob's tuned profile
// was dead code and nobody could tell by reading the table. The shell's gameGuide
// alias map had a duplicate too.
//
// esbuild already flags these while bundling; this test just fails the suite on them
// instead of letting a build warning scroll past.
import { describe, it, expect } from 'vitest';
import { transformSync } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Every source file, including the legacy monolith (that is where half the object
// literals still live) but excluding the base64 asset blobs, which are megabytes of
// string with no object literals to check.
//
// Hand-rolled walk rather than fs.globSync / readdirSync({recursive}) — both are
// newer than the Node 20 the CI gate runs, so either one passes locally and fails
// there.
function sourceFiles(dir = 'src', out = []) {
  for (const entry of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (rel !== join('src', 'assets')) sourceFiles(rel, out);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(rel);
    }
  }
  return out.sort();
}

describe('no duplicate object keys in src/', () => {
  it('every module parses with zero duplicate-key warnings', () => {
    const offenders = [];
    for (const file of sourceFiles()) {
      const code = readFileSync(resolve(ROOT, file), 'utf8');
      const { warnings } = transformSync(code, { loader: 'js', format: 'esm' });
      for (const w of warnings) {
        if (w.id !== 'duplicate-object-key') continue;
        offenders.push(`${relative(ROOT, file)}:${w.location ? w.location.line : '?'} — ${w.text}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
