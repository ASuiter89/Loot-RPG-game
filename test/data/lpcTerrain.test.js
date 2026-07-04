import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { blobMissingMasks } from '../../src/systems/terrainAtlas.js';

// The LPC terrain autotiler + its role tables still live inline in the legacy
// monolith, so this data-validity guard reads them out of the source text (no DOM
// import) the same way the changelog test pins its data. It exists to keep the
// "missing Wang mask → hard-edged primary tile" bug from ever coming back: every
// terrain role a biome or built interior paints MUST ship all 15 blob tiles, or
// the renderer falls back to a flat fill where a smooth curved edge belongs.
// vitest runs with the repo root as cwd (vite.config `root: '.'`).
const src = readFileSync(resolve(process.cwd(), 'src/legacy/game.js'), 'utf8');

function jsonConst(name) {
  const line = src.split('\n').find((l) => l.startsWith(`const ${name} = `));
  if (!line) throw new Error(`could not find "const ${name} =" in legacy/game.js`);
  return JSON.parse(line.replace(`const ${name} = `, '').replace(/;\s*$/, ''));
}
function blockRoles(name) {
  // Grab the `const NAME = { ... };` object literal (single- OR multi-line: stop
  // at the first `};`, since the inner entries close with `},` not `};`) and pull
  // every single-quoted string out of it — those are the terrain-role names.
  const m = src.match(new RegExp(`const ${name} = \\{[\\s\\S]*?\\};`));
  if (!m) throw new Error(`could not find "const ${name} = {…}" block`);
  return [...m[0].matchAll(/'([A-Za-z0-9_]+)'/g)].map((x) => x[1]);
}

const LPC_TABLE = jsonConst('LPC_TABLE');
// Every role name referenced by an outdoor biome or a built-interior role/wall.
const referenced = new Set([
  ...blockRoles('LPC_BIOME'),
  ...blockRoles('INDOOR_ROLES'),
  ...blockRoles('INDOOR_WALL'),
]);
// Keep only the ones that are actual autotiled terrain roles (in the atlas table).
const usedRoles = [...referenced].filter((r) => LPC_TABLE.table[r]);

describe('LPC terrain table', () => {
  it('parses out of the legacy source', () => {
    expect(LPC_TABLE && LPC_TABLE.table).toBeTruthy();
    expect(Object.keys(LPC_TABLE.table).length).toBeGreaterThan(20);
  });

  it('references a sane, non-trivial set of roles from the biome/indoor maps', () => {
    expect(usedRoles.length).toBeGreaterThan(15);
    // spot-check a couple that must always exist
    expect(usedRoles).toContain('Rock_Gray');
    expect(usedRoles).toContain('Mudstone_Gray'); // the role that regressed
  });

  it('every biome/indoor role ships a COMPLETE 15-mask blob (no autotile gaps)', () => {
    const offenders = usedRoles
      .map((r) => ({ role: r, missing: blobMissingMasks(LPC_TABLE.table[r]) }))
      .filter((o) => o.missing.length);
    expect(
      offenders,
      `these autotiled terrain roles are missing Wang masks (they will render hard-edged\n` +
      `fallback fills instead of smooth transitions):\n` +
      offenders.map((o) => `  ${o.role}: missing ${o.missing.join(',')}`).join('\n'),
    ).toEqual([]);
  });

  it('Mudstone_Gray specifically carries its mask-9 diagonal (the fixed gap)', () => {
    expect(LPC_TABLE.table.Mudstone_Gray[9]).toBe(889);
  });
});
