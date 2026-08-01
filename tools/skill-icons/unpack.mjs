// Explode the packed sheet in src/assets/skillIconsAtlas.js back into one PNG
// per key under .work/tiles/.
//
// WHY THIS EXISTS
// pack.mjs rebuilds the index from whatever sits in the tiles directory, so
// packing a partial set would silently DROP every icon not present. The tiles
// are a gitignored cache, so a fresh clone has none — which used to mean the
// only way to add one icon was to re-run the whole (paid) generation for all of
// them. Unpacking the shipped sheet restores the cache losslessly instead: the
// atlas is already at the final cell size, so a 1:1 blit round-trips exactly.
//
// Usage:
//   node tools/skill-icons/unpack.mjs            # -> .work/tiles/<key>.png
//   node tools/skill-icons/unpack.mjs --force    # overwrite existing tiles
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { launchChromium } from './pw.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = process.env.SKILL_ICON_WORKDIR || resolve(HERE, '.work');
const TILE_DIR = join(WORK, 'tiles');
const ATLAS = resolve(HERE, '../../src/assets/skillIconsAtlas.js');

const force = process.argv.includes('--force');
const src = readFileSync(ATLAS, 'utf8');

// Match to END OF LINE, not to the first ';' — the atlas value is a data URL
// ('data:image/png;base64,…') whose own semicolon would truncate the capture.
// pack.mjs emits one export per line, so anchoring on the line is exact.
const grab = (name) => {
  const m = new RegExp(`^export const ${name} = (.*);$`, 'm').exec(src);
  if (!m) throw new Error(`could not read ${name} from ${ATLAS}`);
  return m[1].trim();
};
const COLS = +grab('SKILL_ICON_COLS');
const TS = +grab('SKILL_ICON_TS');
const INDEX = JSON.parse(grab('SKILL_ICON_INDEX'));
const DATA = grab('SKILL_ICON_ATLAS').replace(/^'|'$/g, '');

const keys = Object.keys(INDEX);
console.log(`Atlas: ${keys.length} cells, ${COLS} cols @ ${TS}px`);
mkdirSync(TILE_DIR, { recursive: true });

const browser = await launchChromium(chromium);
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset=utf8><canvas id=c></canvas>');
await page.evaluate(() => {
  window.__slice = async (dataUrl, cells, cols, ts) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const cv = document.getElementById('c');
    cv.width = ts; cv.height = ts;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;              // 1:1 blit — no resampling
    const out = [];
    for (const { key, i } of cells) {
      ctx.clearRect(0, 0, ts, ts);
      ctx.drawImage(img, (i % cols) * ts, ((i / cols) | 0) * ts, ts, ts, 0, 0, ts, ts);
      out.push({ key, url: cv.toDataURL('image/png') });
    }
    return out;
  };
});

const cells = keys.map((key) => ({ key, i: INDEX[key] }));
const sliced = await page.evaluate(
  async ([d, c, cols, ts]) => window.__slice(d, c, cols, ts), [DATA, cells, COLS, TS]);
await browser.close();

let wrote = 0, skipped = 0;
for (const { key, url } of sliced) {
  const file = join(TILE_DIR, key + '.png');
  if (!force && existsSync(file)) { skipped++; continue; }
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  wrote++;
}
console.log(`Wrote ${wrote} tile(s) -> ${TILE_DIR}${skipped ? `  (${skipped} already present, kept)` : ''}`);
