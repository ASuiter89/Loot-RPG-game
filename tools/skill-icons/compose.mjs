// Compose final skill-icon tiles in headless Chromium (Canvas 2D) — no native
// image libs needed, and it mirrors how the game itself renders pixel art.
//
// Input:  a transparent-background PNG (the icon art, alpha-masked) + a class.
// Output: an opaque, class-themed tile PNG:
//           dark neutral (class-tinted) rounded-square background
//           + the art composited on top with a soft lift shadow
//           + a bold class-coloured border.
//
// Usage (as a module):
//   import { composeTiles } from './compose.mjs'
//   await composeTiles([{ key, srcPath, cls }], { outDir, size })
//
// Usage (CLI):  node compose.mjs <manifest.json>
//   manifest = { outDir, size?, items: [{ key, srcPath, cls }] }
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CLASS_TILE } from './colors.mjs';
import { launchChromium } from './pw.mjs';

const PAGE_HTML = `<!doctype html><meta charset=utf8><canvas id=c></canvas>`;

// The whole tile is drawn by this function, serialised into the page. Keep it
// self-contained (no closure refs) so page.evaluate can stringify it.
function TILE_DRAW() {
  window.__composeTile = async (dataUrl, size, fill, border) => {
    const S = size;
    const cv = document.getElementById('c');
    cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });

    const m = Math.round(S * 0.05);                     // margin for the drop shadow
    const W = S - m * 2;                                 // badge box size
    const ox = m, oy = m;
    const bw = Math.max(4, Math.round(S * 0.092));       // border thickness
    const r = Math.round(S * 0.155);                     // outer corner radius
    const ir = Math.max(2, r - bw);                      // inner corner radius
    const ix = ox + bw, iy = oy + bw, iw = W - bw * 2;   // art well
    const rr = (x, y, w, h, rad) => {
      rad = Math.max(0, Math.min(rad, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    };
    const shade = (hex, f) => {
      const n = parseInt(hex.slice(1), 16);
      let R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
      if (f >= 0) { R += (255 - R) * f; G += (255 - G) * f; B += (255 - B) * f; }
      else { R *= 1 + f; G *= 1 + f; B *= 1 + f; }
      return `rgb(${R | 0},${G | 0},${B | 0})`;
    };

    ctx.clearRect(0, 0, S, S);

    // ── Drop shadow silhouette ────────────────────────────────────────────
    // The badge casts a soft shadow so it floats like a physical medallion.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = S * 0.05;
    ctx.shadowOffsetY = Math.round(S * 0.028);
    rr(ox + 0.5, oy + 0.5, W - 1, W - 1, r);
    ctx.fillStyle = shade(border, -0.35);
    ctx.fill();
    ctx.restore();

    // ── Rounded metal bead frame ──────────────────────────────────────────
    // Concentric strokes from the outer edge inward paint a CONVEX cross-section
    // (dark outer lip → bright crown → dark inner lip), so the border reads as a
    // rounded rim bulging out of the tile rather than a flat band.
    const bead = (t) => {                       // t: 0 outer → 1 inner
      const peak = 0.34;
      return t < peak
        ? -0.28 + (t / peak) * 0.98             // dark lip → bright crown
        : 0.70 - ((t - peak) / (1 - peak)) * 1.18; // crown → dark inner shadow
    };
    for (let i = 0; i <= bw; i++) {
      const t = i / bw;
      rr(ox + i + 0.5, oy + i + 0.5, W - 2 * i - 1, W - 2 * i - 1, Math.max(1, r - i));
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = shade(border, bead(t));
      ctx.stroke();
    }

    // ── Recessed art well ─────────────────────────────────────────────────
    ctx.save();
    rr(ix, iy, iw, iw, ir);
    ctx.clip();
    const bgGrad = ctx.createLinearGradient(0, iy, 0, iy + iw);
    bgGrad.addColorStop(0, shade(fill, 0.16));
    bgGrad.addColorStop(1, shade(fill, -0.16));
    ctx.fillStyle = bgGrad; ctx.fillRect(ix, iy, iw, iw);

    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, ix, iy, iw, iw);            // art fills the well edge-to-edge

    const vg = ctx.createRadialGradient(S / 2, iy + iw * 0.46, iw * 0.18, S / 2, iy + iw * 0.5, iw * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vg; ctx.fillRect(ix, iy, iw, iw);

    // Inset shadow cast INWARD by the raised frame — an even dark halo hugging
    // the whole inner edge, so the well looks sunk beneath the rim.
    ctx.shadowColor = 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = Math.round(bw * 0.95);
    ctx.lineWidth = Math.round(bw * 0.7);
    ctx.strokeStyle = '#000';
    const off = ctx.lineWidth;
    rr(ix - off, iy - off, iw + off * 2, iw + off * 2, ir + off);
    ctx.stroke();
    ctx.restore();

    // ── Metallic sheen ────────────────────────────────────────────────────
    // A glossy diagonal light-sweep over the whole badge sells polished metal.
    ctx.save();
    rr(ox, oy, W, W, r); ctx.clip();
    const gloss = ctx.createLinearGradient(ox, oy, ox + W * 0.5, oy + W);
    gloss.addColorStop(0.00, 'rgba(255,255,255,0.24)');
    gloss.addColorStop(0.30, 'rgba(255,255,255,0.06)');
    gloss.addColorStop(0.46, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss; ctx.fillRect(ox, oy, W, W);
    ctx.restore();

    return cv.toDataURL('image/png');
  };
}

export async function composeTiles(items, { outDir, size = 96 } = {}) {
  mkdirSync(outDir, { recursive: true });
  const browser = await launchChromium(chromium);
  const page = await browser.newPage();
  await page.setContent(PAGE_HTML);
  await page.evaluate(TILE_DRAW);
  const out = [];
  for (const it of items) {
    const cls = it.cls;
    const pal = CLASS_TILE[cls];
    if (!pal) throw new Error(`no palette for class ${cls} (${it.key})`);
    const b64 = readFileSync(it.srcPath).toString('base64');
    const srcUrl = 'data:image/png;base64,' + b64;
    const dataUrl = await page.evaluate(
      async ([u, s, f, br]) => window.__composeTile(u, s, f, br),
      [srcUrl, size, pal.bg, pal.border]
    );
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    const file = join(outDir, it.key + '.png');
    writeFileSync(file, buf);
    out.push({ key: it.key, cls, file, bytes: buf.length });
  }
  await browser.close();
  return out;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const res = await composeTiles(manifest.items, { outDir: manifest.outDir, size: manifest.size });
  console.log(JSON.stringify(res, null, 2));
}
