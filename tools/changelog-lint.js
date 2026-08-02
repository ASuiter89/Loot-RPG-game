#!/usr/bin/env node
/*
 * changelog-lint — integrity guard for src/data/changelog.js.
 *
 * WHY THIS EXISTS: `.gitattributes` marks the changelog `merge=union` so two PRs
 * that both prepend an entry stop colliding (see .gitattributes and CLAUDE.md ▸
 * "A stalled PR is yours to finish"). Union is right most of the time, but it has
 * a corruption mode. Two branches both inserting at the TOP of the array produce
 * hunks whose LAST line is the identical `  ] },`. Git treats that shared line as
 * trailing CONTEXT rather than part of either insertion, so union emits ours +
 * theirs + that context line ONCE — and whichever entry sorts first is left with
 * its object literal unclosed. The file stops parsing, which takes down the data
 * test, index-syntax, duplicate-keys and the build all at once.
 *
 * That happened twice in a row on 2026-08-01 (PRs #747 and #749 landing beside an
 * in-flight PR), and each time auto-merge.yml had already PUSHED the broken blob
 * before any gate ran. This tool is what that step now runs before pushing: it
 * fails loudly on a corrupt changelog instead of publishing unparseable JS.
 *
 * It is dependency-free ON PURPOSE — auto-merge.yml runs it before `npm ci`, so
 * it must work with nothing but a stock Node.
 *
 * Usage:  node tools/changelog-lint.js
 * Exits non-zero if the changelog fails to parse or its shape is wrong.
 */
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'src', 'data', 'changelog.js');

const errors = [];

// Parse + evaluate. A union-mangled entry fails right here, with the same
// SyntaxError the test suite would report — but before anything is pushed.
let CHANGELOG;
try {
  ({ CHANGELOG } = await import(pathToFileURL(FILE).href));
} catch (e) {
  console.error('changelog-lint: FAIL — src/data/changelog.js does not parse.\n');
  console.error(`  ${String(e && e.message || e).split('\n').join('\n  ')}\n`);
  console.error('  This is the merge=union collapse if a merge just ran: an entry lost its');
  console.error('  closing "] }," to the entry below it. Restore the missing close, and');
  console.error('  consider putting the entry on ONE line — a whole entry on a single line');
  console.error('  shares no trailing text with its neighbours, so union cannot fold it.');
  process.exit(1);
}

if (!Array.isArray(CHANGELOG)) {
  errors.push('CHANGELOG is not an array');
} else if (!CHANGELOG.length) {
  errors.push('CHANGELOG is empty');
} else {
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  CHANGELOG.forEach((e, i) => {
    const at = `entry ${i}${e && e.v ? ` ("${e.v}")` : ''}`;
    if (!e || typeof e !== 'object') { errors.push(`${at}: not an object`); return; }
    if (!DATE.test(String(e.date || ''))) errors.push(`${at}: bad or missing date ${JSON.stringify(e.date)}`);
    if (!e.v || typeof e.v !== 'string') errors.push(`${at}: missing title (v)`);
    if (!e.by || typeof e.by !== 'string') errors.push(`${at}: missing author (by)`);
    if (!Array.isArray(e.notes) || !e.notes.length) errors.push(`${at}: notes must be a non-empty array`);
    else if (!e.notes.every((n) => typeof n === 'string' && n.trim())) errors.push(`${at}: every note must be a non-empty string`);
  });
  // Broadly newest-first, matching the data test's invariant (first >= last) and
  // NOT a strict adjacent-pair check: a union merge legitimately shuffles entries
  // that landed the same day, which CLAUDE.md calls cosmetic. Only a wholesale
  // inversion is a real defect.
  const first = CHANGELOG[0], last = CHANGELOG[CHANGELOG.length - 1];
  if (first && last && DATE.test(String(first.date || '')) && DATE.test(String(last.date || '')) && first.date < last.date) {
    errors.push(`array runs oldest-first: entry 0 is ${first.date}, the last is ${last.date}`);
  }
}

if (errors.length) {
  console.error('changelog-lint: FAIL\n');
  for (const e of errors.slice(0, 40)) console.error('  ✗ ' + e);
  if (errors.length > 40) console.error(`  … and ${errors.length - 40} more`);
  process.exit(1);
}
console.log(`changelog-lint: OK — ${CHANGELOG.length} entries parse and are well-formed, newest-first.`);
