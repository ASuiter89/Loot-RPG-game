// Compose final skill-icon tiles in headless Chromium (Canvas 2D) — no native
// image libs needed, and it mirrors how the game itself renders pixel art.
//
// Input:  a transparent-background PNG (the icon art, alpha-masked) + a class.
// Output: an opaque, class-themed tile PNG:
//           dark neutral (class-tinted) background well
//           + the art composited on top, filling the well edge-to-edge
//           + a bold, raised class-coloured metal-bead border.
//
// The tile SHAPE is either a rounded square (normal skills) or an octagon
// (keystone passives — matching the octagonal node frame in the SKILLS menu,
// CSS clip-path polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)).
//
// Usage (as a module):
//   import { composeTiles } from './compose.mjs'
//   await composeTiles([{ key, srcPath, cls, shape }], { outDir, size })
//     shape: 'rounded' (default) | 'octagon'
//
// Usage (CLI):  node compose.mjs <manifest.json>
//   manifest = { outDir, size?, items: [{ key, srcPath, cls, shape }] }
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CLASS_TILE } from './colors.mjs';
import { launchChromium } from './pw.mjs';

const PAGE_HTML = `<!doctype html><meta charset=utf8><canvas id=c></canvas>`;

// The whole tile is drawn by this function, serialised into the page. Keep it
// self-contained (no closure refs) so page.evaluate can stringify it.
function TILE_DRAW() {
  window.__composeTile = async (dataUrl, size, fill, border, shape) => {
    const S = size;
    const cv = document.getElementById('c');
    cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });

    const oct = shape === 'octagon';
    // Badges are FULL-BLEED — they fill their slot edge-to-edge, exactly matching
    // the footprint of the neighbouring potion / town-portal buttons. Depth comes
    // from the raised bead frame + inset shadow, not a drop shadow with margin.
    const m = 0;
    const W = S - m * 2;                                 // badge box size
    const ox = m, oy = m;
    const bw = Math.max(4, Math.round(S * 0.092));       // border thickness
    const r = Math.round(S * 0.155);                     // outer corner radius (rounded)
    const ir = Math.max(2, r - bw);                      // inner corner radius (rounded)
    const ix = ox + bw, iy = oy + bw, iw = W - bw * 2;   // art well
    const CUT = 0.30;                                     // octagon corner cut (matches CSS)
    // Draw the tile silhouette at (x,y,w,h): a rounded rect, or an octagon whose
    // corner cut matches the SKILLS-menu keystone clip-path. `rad` (rounded only).
    const rr = (x, y, w, h, rad) => {
      if (oct) {
        const cx = w * CUT, cy = h * CUT;
        ctx.beginPath();
        ctx.moveTo(x + cx, y);
        ctx.lineTo(x + w - cx, y);
        ctx.lineTo(x + w, y + cy);
        ctx.lineTo(x + w, y + h - cy);
        ctx.lineTo(x + w - cx, y + h);
        ctx.lineTo(x + cx, y + h);
        ctx.lineTo(x, y + h - cy);
        ctx.lineTo(x, y + cy);
        ctx.closePath();
        return;
      }
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

    // ── Base fill ─────────────────────────────────────────────────────────
    // Solid base so the frame's corners/edges are covered before the bead strokes.
    rr(ox + 0.5, oy + 0.5, W - 1, W - 1, r);
    ctx.fillStyle = shade(border, -0.35);
    ctx.fill();

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
    // Trim transparent margins so the actual subject — not a big empty canvas —
    // fills the well. Fit the alpha bounding box into the well (contain, centred)
    // so a small centred subject expands to fill the badge without distortion.
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    try {
      const off = document.createElement('canvas');
      off.width = img.width; off.height = img.height;
      const octx = off.getContext('2d');
      octx.drawImage(img, 0, 0);
      const d = octx.getImageData(0, 0, img.width, img.height).data;
      let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
      const A = 12;                                  // alpha threshold
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          if (d[(y * img.width + x) * 4 + 3] > A) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      // Only trim if a real (and not near-full) subject was found.
      if (maxX >= minX && maxY >= minY && (maxX - minX) < img.width - 2 && (maxY - minY) < img.height - 2) {
        sx = minX; sy = minY; sw = maxX - minX + 1; sh = maxY - minY + 1;
      }
    } catch (e) { /* tainted / unreadable — draw untrimmed */ }
    const pad = iw * 0.02;
    const avail = iw - pad * 2;
    const scale = Math.min(avail / sw, avail / sh);
    const dw = sw * scale, dh = sh * scale;
    const dx = ix + (iw - dw) / 2, dy = iy + (iw - dh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);   // trimmed subject fills the well

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
      async ([u, s, f, br, sh]) => window.__composeTile(u, s, f, br, sh),
      [srcUrl, size, pal.bg, pal.border, it.shape || 'rounded']
    );
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    const file = join(outDir, it.key + '.png');
    writeFileSync(file, buf);
    out.push({ key: it.key, cls, shape: it.shape || 'rounded', file, bytes: buf.length });
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
