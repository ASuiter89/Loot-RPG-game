// Orchestrate skill-icon generation end-to-end for a chosen set of icon keys:
//   generate art (Scenario) -> remove background -> download transparent PNG
//   -> composite into the class-themed metal-badge tile.
//
// Transparent sources and final tiles are cached on disk so re-runs are cheap and
// border tweaks never re-hit the paid API. Already-produced tiles are skipped
// unless --force.
//
// Usage:
//   node tools/skill-icons/generate.mjs sk_wa_whirl sk_ra_backstab ...   # subset
//   node tools/skill-icons/generate.mjs --all                            # everything
//   node tools/skill-icons/generate.mjs --all --concurrency 8 --force
//
// Env: SCENARIO_SDK_API_KEY, SCENARIO_SDK_API_SECRET
//      SKILL_ICON_WORKDIR (default: tools/skill-icons/.work)
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { parseSkillIcons, iconPrompt } from './skills.mjs';
import { makeTransparentIcon } from './scenario.mjs';
import { composeTiles } from './compose.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = process.env.SKILL_ICON_WORKDIR || resolve(HERE, '.work');
const SRC_DIR = join(WORK, 'transparent');   // downloaded, bg-removed art
const TILE_DIR = join(WORK, 'tiles');        // final composited badges
const TILE_SIZE = 128;

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  }));
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const all = argv.includes('--all');
  const ci = argv.indexOf('--concurrency');
  const concurrency = ci >= 0 ? +argv[ci + 1] : 6;
  const keys = argv.filter((a) => a.startsWith('sk_'));

  mkdirSync(SRC_DIR, { recursive: true });
  mkdirSync(TILE_DIR, { recursive: true });

  const { icons } = parseSkillIcons();
  const byKey = new Map(icons.map((e) => [e.icon, e]));
  let targets;
  if (all) targets = icons;
  else {
    targets = keys.map((k) => byKey.get(k)).filter(Boolean);
    const missing = keys.filter((k) => !byKey.has(k));
    if (missing.length) console.warn('WARN unknown icon keys:', missing.join(', '));
  }
  if (!targets.length) { console.error('No target icons. Pass sk_* keys or --all.'); process.exit(2); }

  console.log(`Targets: ${targets.length}  concurrency=${concurrency}  force=${force}`);

  // 1) Art step (generate + bg-removal + download) — cached per transparent PNG.
  const results = await pool(targets, concurrency, async (e) => {
    const srcPath = join(SRC_DIR, e.icon + '.png');
    if (!force && existsSync(srcPath)) { console.log(`skip art  ${e.icon} (cached)`); return { ...e, srcPath, cached: true }; }
    try {
      await makeTransparentIcon(iconPrompt(e.name), srcPath);
      console.log(`art  ✓ ${e.icon}  «${e.name}»`);
      return { ...e, srcPath };
    } catch (err) {
      console.error(`art  ✗ ${e.icon}  «${e.name}»: ${err.message}`);
      return { ...e, srcPath, error: err.message };
    }
  });

  const ok = results.filter((r) => !r.error && existsSync(r.srcPath));
  const failed = results.filter((r) => r.error || !existsSync(r.srcPath));

  // 2) Compose all successful tiles.
  const composed = await composeTiles(
    ok.map((r) => ({ key: r.icon, srcPath: r.srcPath, cls: r.cls })),
    { outDir: TILE_DIR, size: TILE_SIZE }
  );
  console.log(`Composed ${composed.length} tiles into ${TILE_DIR}`);
  if (failed.length) console.log(`FAILED (${failed.length}): ${failed.map((f) => f.icon).join(', ')}`);

  // 3) Manifest for the packer.
  const manifest = {
    size: TILE_SIZE,
    icons: composed.map((c) => ({ key: c.key, cls: c.cls, file: c.file })),
    failed: failed.map((f) => ({ key: f.icon, error: f.error })),
  };
  writeFileSync(join(WORK, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${join(WORK, 'manifest.json')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
