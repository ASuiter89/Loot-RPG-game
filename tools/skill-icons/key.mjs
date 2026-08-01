// Turn the white-background art masters in art/skill-icons/<class>/ into the
// transparent PNGs the badge compositor expects, and (optionally) downscale the
// masters themselves.
//
// WHY A FLOOD FILL, NOT A THRESHOLD
// The house style asks every icon for a "bright near-white CORE" — pale gold
// highlights, white glints on steel, the hot centre of a burst. A global
// "near-white -> transparent" threshold punches holes straight through those.
// So we only clear white that is CONNECTED TO THE BORDER: a 4-way flood fill
// seeded from every edge pixel. Interior highlights are never reached, however
// bright they are.
//
// Usage:
//   node tools/skill-icons/key.mjs                      # key every class
//   node tools/skill-icons/key.mjs fortune              # one class
//   node tools/skill-icons/key.mjs fortune --downscale  # also shrink masters in place
//   node tools/skill-icons/key.mjs --tolerance 18 --probe
//
// Reads : art/skill-icons/<class>/<key>.png     (committed masters, white bg)
// Writes: tools/skill-icons/.work/transparent/<key>.png   (gitignored cache)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { launchChromium } from './pw.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const ART = join(ROOT, 'art/skill-icons');
const WORK = process.env.SKILL_ICON_WORKDIR || resolve(HERE, '.work');
const OUT = join(WORK, 'transparent');

// Masters land at whatever the image model emitted (2048px is common). The final
// cell is 96px and the art is a ~64px logical grid, so 1024 is still 16x
// oversampled — plenty of headroom, a fraction of the bytes in git.
const MASTER_MAX = 1024;

const PAGE = `<!doctype html><meta charset=utf8><canvas id=c></canvas>`;

// Serialised into the page; keep self-contained (no closure refs).
function KEY_DRAW() {
  // Clear border-connected background to alpha. Returns {dataUrl, stats}.
  window.__key = async (dataUrl, tol, maxSize) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const cv = document.getElementById('c');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    const W = img.width, H = img.height;
    const im = ctx.getImageData(0, 0, W, H);
    const d = im.data;
    const N = W * H;

    // A pixel counts as background if it is near-white. `tol` is how far below
    // 255 each channel may sit and still be treated as paper.
    const lo = 255 - tol;
    const isBg = (i) => d[i] >= lo && d[i + 1] >= lo && d[i + 2] >= lo;

    // 4-way flood fill seeded from every border pixel, iterative (no recursion:
    // a 2048x2048 frame would blow the stack).
    const seen = new Uint8Array(N);
    const queue = new Int32Array(N);
    let qh = 0, qt = 0;
    const push = (p) => { if (!seen[p] && isBg(p * 4)) { seen[p] = 1; queue[qt++] = p; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (qh < qt) {
      const p = queue[qh++];
      const x = p % W, y = (p / W) | 0;
      if (x > 0) push(p - 1);
      if (x < W - 1) push(p + 1);
      if (y > 0) push(p - W);
      if (y < H - 1) push(p + W);
    }

    let cleared = 0, interiorWhite = 0;
    for (let p = 0; p < N; p++) {
      if (seen[p]) { d[p * 4 + 3] = 0; cleared++; }
      else if (isBg(p * 4)) interiorWhite++;   // a highlight we deliberately kept
    }
    ctx.putImageData(im, 0, 0);

    // Alpha bounding box of what survived — the compositor trims to this, so a
    // stray speck in a corner would shrink the real subject.
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 12) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }

    // Optional downscale, done AFTER keying so alpha edges stay crisp.
    let outCv = cv;
    if (maxSize && Math.max(W, H) > maxSize) {
      const s = maxSize / Math.max(W, H);
      const o = document.createElement('canvas');
      o.width = Math.round(W * s); o.height = Math.round(H * s);
      const octx = o.getContext('2d');
      octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
      octx.drawImage(cv, 0, 0, o.width, o.height);
      outCv = o;
    }

    return {
      dataUrl: outCv.toDataURL('image/png'),
      stats: {
        w: W, h: H, out: outCv.width,
        clearedPct: +(100 * cleared / N).toFixed(1),
        interiorWhitePct: +(100 * interiorWhite / N).toFixed(2),
        bbox: maxX >= minX ? [minX, minY, maxX - minX + 1, maxY - minY + 1] : null,
        coverPct: maxX >= minX ? +(100 * (maxX - minX + 1) * (maxY - minY + 1) / N).toFixed(1) : 0,
      },
    };
  };

  // Downscale only — used to shrink the committed masters, background intact.
  window.__shrink = async (dataUrl, maxSize) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    if (Math.max(img.width, img.height) <= maxSize) return null;
    const s = maxSize / Math.max(img.width, img.height);
    const o = document.createElement('canvas');
    o.width = Math.round(img.width * s); o.height = Math.round(img.height * s);
    const ctx = o.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  };
}

const argv = process.argv.slice(2);
const flag = (n, dflt) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : dflt; };
const tolerance = +flag('--tolerance', 14);
const downscale = argv.includes('--downscale');
const probe = argv.includes('--probe');
const classes = argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));

const targets = (classes.length ? classes : ['fortune', 'windblade', 'bloodletter'])
  .filter((c) => existsSync(join(ART, c)));

mkdirSync(OUT, { recursive: true });
const browser = await launchChromium(chromium);
const page = await browser.newPage();
await page.setContent(PAGE);
await page.evaluate(KEY_DRAW);

let n = 0, warned = 0, savedBytes = 0;
for (const cls of targets) {
  const dir = join(ART, cls);
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  console.log(`\n── ${cls}: ${files.length} master(s)`);
  for (const f of files) {
    const src = join(dir, f);
    const before = statSync(src).size;
    const url = 'data:image/png;base64,' + readFileSync(src).toString('base64');

    const { dataUrl, stats } = await page.evaluate(
      async ([u, t, m]) => window.__key(u, t, m), [url, tolerance, MASTER_MAX]);

    if (!probe) writeFileSync(join(OUT, f), Buffer.from(dataUrl.split(',')[1], 'base64'));

    if (downscale && !probe) {
      const shrunk = await page.evaluate(async ([u, m]) => window.__shrink(u, m), [url, MASTER_MAX]);
      if (shrunk) {
        const buf = Buffer.from(shrunk.split(',')[1], 'base64');
        writeFileSync(src, buf);
        savedBytes += before - buf.length;
      }
    }

    // Flag the two ways keying goes wrong: nothing cleared (the background was
    // not white / not connected), or the subject barely covers the frame.
    const bad = stats.clearedPct < 5 || stats.coverPct < 25;
    if (bad) warned++;
    console.log(
      `  ${bad ? '!!' : '  '} ${f.padEnd(28)} ${stats.w}->${stats.out}px  ` +
      `cleared ${String(stats.clearedPct).padStart(5)}%  ` +
      `kept-white ${String(stats.interiorWhitePct).padStart(5)}%  ` +
      `cover ${String(stats.coverPct).padStart(5)}%`);
    n++;
  }
}
await browser.close();
console.log(`\n${probe ? 'Probed' : 'Keyed'} ${n} icon(s) -> ${OUT}`);
if (downscale && !probe) console.log(`Masters shrunk to <=${MASTER_MAX}px, saved ${(savedBytes / 1048576).toFixed(1)} MB`);
if (warned) console.log(`WARNING: ${warned} icon(s) flagged — check the '!!' rows above.`);
