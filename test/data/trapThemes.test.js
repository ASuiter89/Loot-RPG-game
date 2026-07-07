import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TRAP_THEME, TRAP_THEME_KINDS } from '../../src/data/trapThemes.js';

const here = dirname(fileURLToPath(import.meta.url));
const gameSrc = readFileSync(resolve(here, '../../src/legacy/game.js'), 'utf8');

describe('trap-theme density table', () => {
  it('covers exactly the three trap kinds', () => {
    expect([...TRAP_THEME_KINDS].sort()).toEqual(['arrows', 'fire', 'spikes']);
  });

  it('packs a themed floor far denser than a plain one', () => {
    // Spikes multiply the usual scatter (rnd 2..5) — a mult > 1 guarantees "a lot".
    expect(TRAP_THEME.spikes.mult).toBeGreaterThan(1);
    // The cap must leave room for the multiplied count, not choke it on a base floor.
    expect(TRAP_THEME.spikes.cap).toBeGreaterThanOrEqual(TRAP_THEME.spikes.mult * 5);
    // Arrow galleries and vent works seat many more than a plain floor's few
    // (arrows cap at 3, fire at 1..3 on ordinary floors).
    for (const kind of ['arrows', 'fire']) {
      expect(TRAP_THEME[kind].min).toBeGreaterThan(3);
      expect(TRAP_THEME[kind].max).toBeGreaterThanOrEqual(TRAP_THEME[kind].min);
    }
  });

  it('every FLOOR_MODS trapTheme names a kind the table defines', () => {
    const used = [...gameSrc.matchAll(/trapTheme:\s*'([a-z]+)'/g)].map(m => m[1]);
    expect(used).toHaveLength(3); // the three themed floor mods, no more, no fewer
    for (const kind of used) expect(TRAP_THEME_KINDS).toContain(kind);
    // …and every defined kind is actually used by a floor mod.
    for (const kind of TRAP_THEME_KINDS) expect(used).toContain(kind);
  });

  it('the placement logic reads the density table', () => {
    expect(gameSrc).toMatch(/TRAP_THEME\.spikes/);
    expect(gameSrc).toMatch(/TRAP_THEME\.arrows/);
    expect(gameSrc).toMatch(/TRAP_THEME\.fire/);
  });
});
