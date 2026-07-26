import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SKILL_ICON_INDEX } from '../../src/assets/skillIconsAtlas.js';
import { HERO_SILHOUETTE_TINT } from '../../src/data/silhouetteTints.js';
import { CLASS_DMG_ATTR, ATTR_STAT_CHANNELS, SHIELD } from '../../src/data/attributeScaling.js';

// The playable roster still lives in the legacy monolith (CLASSES / SKILL_TREES /
// ASCENSIONS / SKILL_BRANCHES), which can't be imported under Node — it touches the
// DOM at module scope. So, like test/systems/vfx.test.js, we parse the real source as
// TEXT: the guarantees below then track the shipped data instead of a fixture that
// drifts away from it. This is the only coverage the class trees have, so it is
// deliberately broad — a new class that forgets a branch table, an unrenderable icon,
// or a dangling prerequisite fails here rather than as a blank panel in-game.
const src = readFileSync(resolve(process.cwd(), 'src/legacy/game.js'), 'utf8');

/** Pull an object-literal block out of the monolith by its `const NAME = {` header. */
function block(name) {
  const start = src.indexOf(`const ${name} = {`);
  expect(start, `${name} not found in the monolith`).toBeGreaterThan(-1);
  const end = src.indexOf('\n};', start);
  expect(end, `${name} has no closing brace`).toBeGreaterThan(start);
  return src.slice(start, end);
}

// Class keys, in declaration order, from the CLASSES table.
const CLASSES_BLOCK = block('CLASSES');
const CLASS_KEYS = [...CLASSES_BLOCK.matchAll(/^  ([a-z]+): \{$/gm)].map(m => m[1]);

// Every JSON-ish tree node in the file: {"id":"w_p00", … }
const NODES = [...src.matchAll(/^ {6}(\{"id":"[a-z]_[pa]\d\d".*\}),?$/gm)]
  .map(m => JSON.parse(m[1]));

// Ascendancy declarations: `key: { base:'cls', name:'…', icon:'…', color:'#…',`
const ASCENSIONS = [...src.matchAll(/^ {2}([a-z]+): \{ base:'([a-z]+)', name:'([^']+)', icon:'([a-z0-9_]+)', color:'(#[0-9a-fA-F]{3,8})',/gm)]
  .map(m => ({ key: m[1], base: m[2], name: m[3], icon: m[4], color: m[5] }));

const NEW_CLASSES = ['fortune', 'windblade', 'bloodletter'];

describe('class roster', () => {
  it('parsed a plausible roster (guards the regexes above)', () => {
    expect(CLASS_KEYS.length).toBeGreaterThanOrEqual(7);
    expect(NODES.length).toBeGreaterThanOrEqual(400);
    expect(ASCENSIONS.length).toBeGreaterThanOrEqual(14);
  });

  it('ships the four original classes plus the three later ones', () => {
    for (const cls of ['warrior', 'rogue', 'mage', 'templar', ...NEW_CLASSES]) {
      expect(CLASS_KEYS, `${cls} missing from CLASSES`).toContain(cls);
    }
  });

  it('gives every class a skill tree, both branch tables and walk art', () => {
    const branches = block('SKILL_BRANCHES');
    const branchDesc = block('SKILL_BRANCH_DESC');
    const heroWalk = block('HERO_WALK');
    const trees = block('SKILL_TREES');
    for (const cls of CLASS_KEYS) {
      expect(trees, `SKILL_TREES.${cls}`).toMatch(new RegExp(`^\\s{2}${cls}: \\{$`, 'm'));
      expect(branches, `SKILL_BRANCHES.${cls}`).toMatch(new RegExp(`${cls}:\\s*\\[`));
      expect(branchDesc, `SKILL_BRANCH_DESC.${cls}`).toMatch(new RegExp(`${cls}:\\s*\\[`));
      expect(heroWalk, `HERO_WALK.${cls}`).toMatch(new RegExp(`${cls}:\\s*\\{`));
    }
  });

  it('names exactly five branches (and five blurbs) per class', () => {
    const branches = block('SKILL_BRANCHES');
    const descs = block('SKILL_BRANCH_DESC');
    for (const cls of CLASS_KEYS) {
      const names = new RegExp(`${cls}:\\s*\\[([^\\]]*)\\]`).exec(branches);
      expect(names, `${cls} branch names`).toBeTruthy();
      expect(names[1].split(',').filter(s => s.trim()), `${cls} branch count`).toHaveLength(5);
      const blurbs = new RegExp(`${cls}: \\[\\n((?:.*\\n)*?)\\s*\\],`).exec(descs);
      expect(blurbs, `${cls} branch blurbs`).toBeTruthy();
      expect(blurbs[1].trim().split('\n'), `${cls} blurb count`).toHaveLength(5);
    }
  });

  it('pins a single body type on the three later classes, and offers both on the rest', () => {
    // A single-sex class ships ONE bespoke 4-direction sheet, so CLASSES[x].sex names
    // it and the name screen hides the body-type picker. The original four ship a
    // female/male pair and must NOT declare a fixed sex.
    const fixed = {};
    for (const m of CLASSES_BLOCK.matchAll(/^  ([a-z]+): \{$/gm)) {
      const start = CLASSES_BLOCK.indexOf(m[0]);
      const end = CLASSES_BLOCK.indexOf('\n  },', start);
      const body = CLASSES_BLOCK.slice(start, end);
      const sex = /^\s*sex: '(female|male)',/m.exec(body);
      if (sex) fixed[m[1]] = sex[1];
    }
    expect(fixed).toEqual({ fortune: 'female', windblade: 'male', bloodletter: 'male' });

    // Each single-sex class declares exactly the one HERO_WALK key it has art for.
    const heroWalk = block('HERO_WALK');
    for (const [cls, sex] of Object.entries(fixed)) {
      const row = new RegExp(`^\\s*${cls}:\\s*\\{([^}]*)\\}`, 'm').exec(heroWalk);
      expect(row, `HERO_WALK.${cls}`).toBeTruthy();
      const other = sex === 'female' ? 'male' : 'female';
      // Match on a key BOUNDARY: a plain substring test for 'male:' also matches
      // 'female:', which would quietly pass this assertion for the female class.
      const declares = (key) => new RegExp(`(^|[{,])\\s*${key}:`).test(row[1]);
      expect(declares(sex), `${cls} ships its ${sex} sheet`).toBe(true);
      expect(declares(other), `${cls} must not declare a ${other} sheet`).toBe(false);
    }
  });

  it('registers every class in each per-class data table', () => {
    for (const cls of CLASS_KEYS) {
      expect(CLASS_DMG_ATTR[cls], `CLASS_DMG_ATTR.${cls}`).toBeTruthy();
      expect(HERO_SILHOUETTE_TINT[cls], `silhouette tint for ${cls}`).toBeTruthy();
      expect(typeof SHIELD.classMult[cls], `SHIELD.classMult.${cls}`).toBe('number');
      for (const [ch, def] of Object.entries(ATTR_STAT_CHANNELS)) {
        expect(def.order, `${ch} ordering missing ${cls}`).toContain(cls);
      }
    }
  });
});

describe('skill tree nodes', () => {
  it('has a unique id for every node', () => {
    const ids = NODES.map(n => n.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  it('resolves every prerequisite to a real node in the same class tree', () => {
    const ids = new Set(NODES.map(n => n.id));
    const dangling = [];
    for (const n of NODES) {
      for (const r of [...(n.req || []), ...(n.reqAny || [])]) {
        if (!ids.has(r)) dangling.push(`${n.id} -> ${r}`);
        // A prerequisite always lives in the same class AND the same tree: ids are
        // `<class letter>_<p|a><band><branch>`, so the first three characters are the
        // class+tree key (`l_a`) and must match.
        else if (r.slice(0, 3) !== n.id.slice(0, 3)) dangling.push(`${n.id} crosses trees to ${r}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('gives band-0 nodes no prerequisite and every later node at least one', () => {
    const bad = [];
    for (const n of NODES) {
      const hasReq = !!((n.req && n.req.length) || (n.reqAny && n.reqAny.length));
      if (n.band === 0 && (hasReq || !n.root)) bad.push(`${n.id} is a root with a prerequisite`);
      if (n.band > 0 && !hasReq) bad.push(`${n.id} is orphaned at band ${n.band}`);
    }
    expect(bad).toEqual([]);
  });

  it('draws every node icon from the packed atlas', () => {
    const missing = NODES.filter(n => SKILL_ICON_INDEX[n.icon] === undefined).map(n => `${n.id} -> ${n.icon}`);
    expect(missing).toEqual([]);
  });

  it('has a keystone-framed (@ks) tile for every keystone', () => {
    // The tree renders a keystone via dlIconFill(icon + '@ks'); without that variant
    // packed, the node draws as an empty box.
    const missing = NODES.filter(n => n.keystone && SKILL_ICON_INDEX[`${n.icon}@ks`] === undefined)
      .map(n => `${n.id} -> ${n.icon}@ks`);
    expect(missing).toEqual([]);
  });

  it('makes keystones single-rank and gates them on points spent', () => {
    for (const n of NODES.filter(n => n.keystone)) {
      expect(n.pts, `${n.id} pts gate`).toBeTruthy();
      expect(n.pts.tree, `${n.id} gates on its own tree`).toBe('passive');
      expect(n.pts.n, `${n.id} gate size`).toBeGreaterThan(0);
    }
  });

  it('keeps keystones on the passive side only', () => {
    const activeKeystones = NODES.filter(n => n.keystone && /_a\d\d$/.test(n.id)).map(n => n.id);
    expect(activeKeystones).toEqual([]);
  });

  it('gives every active a cost, a cooldown and a cast descriptor', () => {
    const bad = [];
    for (const n of NODES.filter(n => /_a\d\d$/.test(n.id))) {
      if (!(n.mp > 0)) bad.push(`${n.id} has no cost`);
      if (!(n.cd > 0)) bad.push(`${n.id} has no cooldown`);
      if (!n.cast || !n.cast.shape) bad.push(`${n.id} has no cast shape`);
    }
    expect(bad).toEqual([]);
  });

  it('describes every node', () => {
    expect(NODES.filter(n => !n.desc || !n.desc.trim()).map(n => n.id)).toEqual([]);
  });

  it('gives each of the three later classes a full 30 + 30 web', () => {
    for (const [cls, prefix] of [['fortune', 'f'], ['windblade', 'z'], ['bloodletter', 'l']]) {
      const passive = NODES.filter(n => n.id.startsWith(`${prefix}_p`));
      const active = NODES.filter(n => n.id.startsWith(`${prefix}_a`));
      expect(passive, `${cls} passives`).toHaveLength(30);
      expect(active, `${cls} actives`).toHaveLength(30);
      expect(passive.filter(n => n.keystone), `${cls} keystones`).toHaveLength(5);
      // Five branches, six nodes deep each (root, two mid pairs, capstone).
      for (let br = 0; br < 5; br++) {
        expect(passive.filter(n => n.br === br), `${cls} passive branch ${br}`).toHaveLength(6);
        expect(active.filter(n => n.br === br), `${cls} active branch ${br}`).toHaveLength(6);
      }
    }
  });
});

describe('ascensions', () => {
  it('bases every ascension on a real class', () => {
    const bad = ASCENSIONS.filter(a => !CLASS_KEYS.includes(a.base)).map(a => `${a.key} -> ${a.base}`);
    expect(bad).toEqual([]);
  });

  it('offers exactly two ascensions per class', () => {
    for (const cls of CLASS_KEYS) {
      const paths = ASCENSIONS.filter(a => a.base === cls).map(a => a.key);
      expect(paths, `${cls} ascension paths`).toHaveLength(2);
    }
  });

  it('gives every ascension a unique key and a distinct name', () => {
    const keys = ASCENSIONS.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    const names = ASCENSIONS.map(a => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('draws every ascension badge from the packed atlas', () => {
    const missing = ASCENSIONS.filter(a => SKILL_ICON_INDEX[a.icon] === undefined)
      .map(a => `${a.key} -> ${a.icon}`);
    expect(missing).toEqual([]);
  });

  it('keeps the three later classes summon-free, so each stays one sprite', () => {
    // Their walk art is a single front-facing strip with no minion art behind it —
    // a summoning path would put a second, unrelated sprite on screen.
    const summoners = [];
    for (const cls of NEW_CLASSES) {
      for (const asc of ASCENSIONS.filter(a => a.base === cls)) {
        const start = src.indexOf(`  ${asc.key}: { base:'${cls}'`);
        const end = src.indexOf(`], null, '${asc.key}') },`, start);
        expect(end, `${asc.key} tree end`).toBeGreaterThan(start);
        if (/shape:'summon'/.test(src.slice(start, end))) summoners.push(asc.key);
      }
    }
    expect(summoners).toEqual([]);
  });

  it('never summons from the three later classes’ base trees either', () => {
    const summons = NODES
      .filter(n => /^[fzl]_a\d\d$/.test(n.id) && n.cast && n.cast.shape === 'summon')
      .map(n => n.id);
    expect(summons).toEqual([]);
  });
});
