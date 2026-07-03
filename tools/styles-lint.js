#!/usr/bin/env node
/*
 * styles-lint — design-system guard for Dungeon Loot (see CLAUDE.md ▸ "Design
 * system"). Flags styling that bypasses the shared token/component system so
 * drift is caught instead of silently accumulating. NOT part of the shipped
 * game — the game stays a single index.html; this is a dev-only check.
 *
 * Usage:  node tools/styles-lint.js
 * Exits non-zero if any ERROR-level violations are found.
 */
// ESM: the repo's package.json declares "type": "module", so this dev-only tool
// is an ES module. (Run with `node tools/styles-lint.js`.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

// Locate the <style> block and the :root token block within it. Colors inside
// :root are the token DEFINITIONS (allowed); everything else must use tokens.
const styleStart = lines.findIndex(l => l.includes('<style>'));
const styleEnd = lines.findIndex(l => l.includes('</style>'));
const rootStart = lines.findIndex((l, i) => i > styleStart && /:root\s*\{/.test(l));
let rootEnd = rootStart;
if (rootStart !== -1) {
  for (let i = rootStart; i < lines.length; i++) {
    if (/^\s*\}/.test(lines[i]) && i > rootStart) { rootEnd = i; break; }
  }
}

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNC_COLOR = /\b(?:rgba?|hsla?)\(/;
// Type scale (rem) the game ships — see the --fs-* tokens in :root.
const SCALE = new Set(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '2', '2.2', '2.6', '3.4']);

const errors = [];   // hard failures — block the commit
const warnings = []; // should fix when you touch the area
const infos = [];    // remaining-audit surface, not a failure

function inStyleBlock(i) { return i > styleStart && i < styleEnd; }
function inRoot(i) { return rootStart !== -1 && i >= rootStart && i <= rootEnd; }

lines.forEach((line, i) => {
  const n = i + 1;
  const code = line.replace(/\/\*.*?\*\//g, ''); // strip inline block comments

  // 1) Raw hex inside the CSS block but outside :root → ERROR (use a token).
  if (inStyleBlock(i) && !inRoot(i) && HEX.test(code) && !/var\(/.test(code.match(/#[0-9a-fA-F]{3,8}[^;]*$/)?.[0] || code)) {
    if (HEX.test(code)) errors.push([n, 'raw hex in CSS — use a --token', line.trim()]);
  }

  // 2) Raw hex in an inline style="…" attribute (anywhere) → WARN.
  const inlineStyles = line.match(/style="[^"]*"/g) || [];
  for (const s of inlineStyles) {
    if (HEX.test(s)) warnings.push([n, 'hardcoded hex in inline style= — use var(--token)', s]);
  }

  // 3) Translucent color literals in CSS outside :root → INFO (tokenize via
  //    --tint-* when you next touch the rule).
  if (inStyleBlock(i) && !inRoot(i) && FUNC_COLOR.test(code)) {
    infos.push([n, 'rgba()/hsl() literal in CSS — consider a --tint-* token', line.trim()]);
  }

  // 4) Off-scale DOM font-size in the CSS block → INFO.
  if (inStyleBlock(i) && !inRoot(i)) {
    const m = code.match(/font-size:\s*([0-9.]+)rem/);
    if (m && !SCALE.has(m[1])) infos.push([n, `off-scale font-size ${m[1]}rem — prefer a --fs-* token`, line.trim()]);
  }
});

function report(title, list, cap) {
  if (!list.length) return;
  console.log(`\n${title} (${list.length})`);
  list.slice(0, cap).forEach(([n, msg, ctx]) => console.log(`  index.html:${n}  ${msg}\n      ${ctx.slice(0, 120)}`));
  if (list.length > cap) console.log(`  … and ${list.length - cap} more`);
}

console.log('styles-lint — design-system guard');
report('ERROR — raw hex in CSS (must use tokens)', errors, 40);
report('WARN — hardcoded hex in inline styles', warnings, 25);
report('INFO — remaining audit surface', infos, 15);

console.log(
  `\nSummary: ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info.`
);
if (errors.length) {
  console.log('FAIL: fix the ERROR items (route them through :root tokens) before committing.');
  process.exit(1);
}
console.log('OK: no hardcoded colors escaped the CSS token layer.');
