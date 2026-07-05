// Cracked-wall render smoke test — boots the REAL built game in Chromium and
// verifies the breakable-wall fracture stays locked to the rock instead of
// spilling its fissures onto the surrounding floor.
//
// The dungeon autotiles the ground OVER a solid wall base, so a lone rock's
// floor-facing edges are overpainted by grass/dirt — the visible "wall" is only
// the part the floor layer leaves standing. lpcCrackOverlayMasked() punches the
// fracture back out wherever the floor covers the cell; this test proves it by
// A/B'ing the masked render against the raw pre-mask one on the SAME floor:
//   • masking must strip near-black crack pixels from the floor band, and
//   • the crack must still read on the rock itself (no over-clip).
//
// Usage: node test/smoke/cracked-wall-render.mjs [path-to-html]  (default index.html)

import { chromium } from 'playwright';
import { existsSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, extname } from 'node:path';
import http from 'node:http';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json',
};
function startServer(rootDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(rootDir)) { res.statusCode = 403; return res.end(); }
    if (!existsSync(filePath)) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
function findExecutable() {
  for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean)) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(__dirname, '../../index.html');
if (!existsSync(target)) { console.error(`cracked-wall: target not found: ${target}`); process.exit(2); }

async function main() {
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  const exe = findExecutable();
  if (exe) launchOpts.executablePath = exe;

  const server = await startServer(dirname(target));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/${basename(target)}?preview=1`;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const failures = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.__previewCrackWall === 'function', { timeout: 20000 });
    await page.waitForTimeout(300);

    // Collect a handful of lone-rock cracked walls across outdoor, light-floored
    // biomes (grass/dirt — high contrast against a near-black fracture). For each,
    // stage it masked (fixed) and raw (pre-mask) on the SAME floor + cell, and
    // count near-black (fracture) pixels in the wall cell. The rock fracture is
    // byte-identical in both renders and cancels, so raw−masked is exactly the
    // fissures masking stripped off the surrounding floor. How much floor autotiles
    // over a lone rock — and which way the fissures fan — varies per wall, so we
    // aggregate several samples rather than bet the assertion on one.
    const samples = await page.evaluate(() => {
      const light = /Moss|Meadow|Grass|Wildflower|Grove|Glade|Fields|Cavern|Woods|Frostwood/i;
      const g = document.getElementById('canvas').getContext('2d');
      const scan = (sx, sy, tw, th) => {
        const W = Math.round(tw), H = Math.round(th);
        const dat = g.getImageData(Math.round(sx), Math.round(sy), W, H).data;
        let cell = 0;
        for (let i = 0; i < dat.length; i += 4) {
          if (dat[i + 3] !== 0 && dat[i] < 55 && dat[i + 1] < 50 && dat[i + 2] < 45) cell++;
        }
        return cell;
      };
      const out = [];
      for (let tries = 0; tries < 600 && out.length < 6; tries++) {
        const r = window.__previewFloor(2 + (tries % 24));
        if (r.err || r.indoor || !light.test(r.biome || '')) continue;
        const m = window.__previewCrackWall(undefined, true);   // masked (fixed)
        if (m.err || !m.island) continue;
        const masked = scan(m.sx, m.sy, m.tw, m.th);
        window.__previewCrackWall(undefined, false);            // same wall, raw pre-mask
        const raw = scan(m.sx, m.sy, m.tw, m.th);
        out.push({ biome: r.biome, level: r.level, cell: m.x + ',' + m.y, masked, raw });
      }
      return out;
    });

    if (samples.length < 3) throw new Error(`only ${samples.length} lone cracked wall(s) found on light outdoor floors`);
    for (const s of samples) {
      console.log(`cracked-wall: ${s.biome} lvl ${s.level} cell ${s.cell} — raw=${s.raw} masked=${s.masked} stripped=${s.raw - s.masked}`);
    }
    const totalRaw = samples.reduce((a, s) => a + s.raw, 0);
    const totalMasked = samples.reduce((a, s) => a + s.masked, 0);
    const totalStripped = totalRaw - totalMasked;
    console.log(`cracked-wall: ${samples.length} samples — total raw=${totalRaw} masked=${totalMasked} stripped=${totalStripped}`);

    // 1. The fracture must still render — a lone rock is never empty and the crack
    //    fans from its centre, so masking always leaves fissures on the wall.
    if (!(totalMasked > 0)) failures.push('masked fractures disappeared entirely (total masked cell=0)');
    // 2. Every raw render must spill onto the floor (else the test can't tell a
    //    working mask from a no-op) and masking must strip it back — a broken/absent
    //    mask leaves raw and masked identical, so stripped collapses to ~0.
    if (!(totalStripped >= samples.length * 3)) {
      failures.push(`masking did not strip the floor spill (total raw=${totalRaw}, masked=${totalMasked}, stripped=${totalStripped} over ${samples.length} samples)`);
    }

    if (pageErrors.length) failures.push(`uncaught page errors:\n  - ${pageErrors.join('\n  - ')}`);
  } catch (e) {
    failures.push(`cracked-wall render check failed: ${String(e).split('\n')[0]}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nCRACKED-WALL RENDER FAILED:');
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\ncracked-wall: PASS —', target);
}
main().catch((e) => { console.error('cracked-wall: unexpected error', e); process.exit(1); });
