import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { globSync } from 'node:fs';

// CHARACTERIZATION / SAFETY-NET TEST.
//
// The game silently fails to load if its script has a syntax error. Since the
// logic now lives in ES modules under src/ (loaded by Vite from index.html),
// this gate validates that (a) index.html still references the module entry and
// carries no stray inline game script, and (b) every src/ and test/ module
// parses as a strict ES module (which also catches module-only errors like
// duplicate top-level declarations that a sloppy-mode check would miss).

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function parsesAsModule(code) {
  try {
    execFileSync('node', ['--check', '--input-type=module'], { input: code, stdio: ['pipe', 'ignore', 'pipe'] });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String(e.stderr || e.message).split('\n').slice(0, 4).join('\n') };
  }
}

describe('index.html script wiring', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

  it('references the ES-module entry via a relative path', () => {
    // Relative so it works at a domain root (Netlify) and a project subpath
    // (GitHub Pages) alike; absolute "/src/…" 404s on a subpath.
    expect(html).toMatch(/<script\s+type="module"\s+src="\.\/src\/main\.js"><\/script>/);
  });

  it('carries no large inline game <script> anymore', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .reduce((n, m) => n + m[1].length, 0);
    // A few tiny inline snippets are fine; the 24k-line monolith must be gone.
    expect(inline).toBeLessThan(2000);
  });
});

describe('every source & test module parses (strict ESM)', () => {
  const files = globSync(
    ['src/**/*.js', 'src/**/*.mjs', 'test/**/*.js', 'test/**/*.mjs'],
    { cwd: ROOT },
  ).map((f) => resolve(ROOT, f));

  it('discovers the source tree', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(files)('%s parses', (file) => {
    const res = parsesAsModule(readFileSync(file, 'utf8'));
    expect(res.ok, `${relative(ROOT, file)} failed to parse:\n${res.err || ''}`).toBe(true);
  });
});
