// Procedural terrain renderer — a PREVIEW path that paints the dungeon ground
// (floor / wall / water / lava) from generated materials instead of the bundled
// LPC atlas. It exists to preview what a full terrain-pack swap looks like in the
// real engine: the game classifies each map cell, this renders the whole floor to
// an offscreen canvas via 2-corner-Wang blending, and the draw loop blits it.
//
// This is render-layer code (owns a canvas); the material maths are pure and
// mirror the tileset/dungeon-floor demos. Not on the default render path — the
// game only calls it when the `?terrain=proc` preview flag is set.

// ---- noise ----
function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y) { return 0.5 * vnoise(x, y) + 0.25 * vnoise(x * 2.03, y * 2.03) + 0.125 * vnoise(x * 4.01, y * 4.01); }
function ridge(x, y) { return 1 - Math.abs(2 * fbm(x, y) - 1); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

// ---- materials: (x,y) world pixel -> [r,g,b] ----
export function matFloor(x, y) { const bw = 12, bh = 8, off = (Math.floor(y / bh) & 1) ? bw * 0.5 : 0; const gx = x + off, col = Math.floor(gx / bw), row = Math.floor(y / bh); const lx = gx - col * bw, ly = y - row * bh; const rnd = hash2(col * 3, row * 5); let r = 122, g = 112, b = 98; const tint = (rnd - 0.5) * 22; r += tint; g += tint * 0.95; b += tint * 0.82; const grit = (fbm(x * 0.8, y * 0.8) - 0.45) * 22; r += grit; g += grit; b += grit * 0.9; const edge = Math.min(lx, bw - lx, ly, bh - ly); if (edge < 1.15) { r -= 56; g -= 53; b -= 47; } else { if (ly < 1.7) { r += 14; g += 14; b += 12; } if (lx < 1.7) { r += 9; g += 9; b += 8; } if (ly > bh - 1.7) { r -= 16; g -= 15; b -= 13; } if (lx > bw - 1.7) { r -= 12; g -= 11; b -= 9; } } const cr = ridge(x * 0.34, y * 0.34); if (cr > 0.93) { const t = (cr - 0.93) / 0.07 * 0.7; r -= 34 * t; g -= 31 * t; b -= 27 * t; } return [r, g, b]; }
export function matWall(x, y) { const bw = 18, bh = 13, off = (Math.floor(y / bh) & 1) ? bw * 0.5 : 0; const gx = x + off, col = Math.floor(gx / bw), row = Math.floor(y / bh); const lx = gx - col * bw, ly = y - row * bh; const rnd = hash2(col * 7, row * 3); let r = 54, g = 47, b = 40; const tint = (rnd - 0.5) * 18; r += tint; g += tint; b += tint * 0.9; const rough = (fbm(x * 1.05, y * 1.05) - 0.4) * 30; r += rough; g += rough * 0.95; b += rough * 0.85; const edge = Math.min(lx, bw - lx, ly, bh - ly); if (edge < 1.35) { r -= 27; g -= 24; b -= 21; } else { if (ly < 3.0) { r += 24; g += 21; b += 18; } if (ly > bh - 2.4) { r -= 19; g -= 17; b -= 15; } } return [r, g, b]; }
export function matWater(x, y) { let r = 34, g = 78, b = 106; const dep = (fbm(x * 0.3, y * 0.3) - 0.5) * 22; r += dep * 0.4; g += dep * 0.7; b += dep; const rip = Math.sin(x * 0.5 + y * 0.28 + fbm(x * 0.25, y * 0.25) * 5); const hl = Math.max(0, rip - 0.58) / 0.42; r += hl * 52; g += hl * 66; b += hl * 60; const sp = ridge(x * 0.6, y * 0.6); if (sp > 0.9) { const t = (sp - 0.9) / 0.1; r += 58 * t; g += 72 * t; b += 66 * t; } return [r, g, b]; }
export function matLava(x, y) { let r = 46, g = 28, b = 22; const warm = fbm(x * 0.5, y * 0.5); r += warm * 24; g += warm * 8; const cr = ridge(x * 0.32, y * 0.32); if (cr > 0.80) { const t = Math.min(1, (cr - 0.80) / 0.20); r = lerp(r, 255, t); g = lerp(g, 150 + 80 * t, t); b = lerp(b, 38 + 66 * t, t * t); } return [r, g, b]; }

const MAT = { floor: matFloor, wall: matWall, water: matWater, lava: matLava };
const RANK = { floor: 0, water: 1, lava: 2, wall: 3 };
const HGT = { floor: 0, wall: 2, water: -1, lava: -1 };

// Render the whole map to an offscreen canvas (W*tw x H*tw). `classify(x,y)`
// returns 'floor' | 'wall' | 'water' | 'lava' for a cell (out-of-bounds -> wall).
// Each pixel picks its terrain from a 2-corner-Wang field over the four
// surrounding cells, samples the material in continuous world-space (so the
// ground never visibly repeats), and shades boundaries by relative height.
export function renderProcMap(classify, W, H, tw) {
  const cv = document.createElement('canvas');
  cv.width = W * tw; cv.height = H * tw;
  const ctx = cv.getContext('2d');
  const Cw = cv.width, Ch = cv.height;
  const img = ctx.createImageData(Cw, Ch);
  const d = img.data;
  for (let py = 0; py < Ch; py++) {
    for (let px = 0; px < Cw; px++) {
      const fx = px / tw - 0.5, fy = py / tw - 0.5;
      const i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
      const c00 = classify(i0, j0), c10 = classify(i0 + 1, j0), c01 = classify(i0, j0 + 1), c11 = classify(i0 + 1, j0 + 1);
      const set = new Set([c00, c10, c01, c11]);
      let T, fld = 1, A, B, isB = true;
      if (set.size === 1) { T = c00; }
      else {
        const arr = [...set].sort((p, q) => RANK[p] - RANK[q]);
        A = arr[0]; B = arr[arr.length - 1];
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        const val = (t) => t === B ? 1 : (t === A ? -1 : 0);
        fld = val(c00) * w00 + val(c10) * w10 + val(c01) * w01 + val(c11) * w11;
        isB = fld > 0; T = isB ? B : A;
      }
      const col = MAT[T](px, py);
      let r = col[0], g = col[1], b = col[2];
      if (set.size > 1) {
        const dh = Math.min(1, Math.abs(HGT[A] - HGT[B]) / 2);
        if (dh > 0) {
          const ad = Math.abs(fld), near = Math.max(0, 1 - ad / 0.5), rim = Math.max(0, 1 - ad / 0.16);
          const hiB = HGT[B] > HGT[A], hiA = HGT[A] > HGT[B];
          const shadedLower = (hiB && !isB) || (hiA && isB), litHigher = (hiB && isB) || (hiA && !isB);
          if (shadedLower) { const s = near * 46 * dh; r -= s; g -= s * 0.96; b -= s * 0.9; }
          if (litHigher) { const s = rim * 22 * dh; r += s; g += s * 0.98; b += s * 0.92; }
          if (ad < 0.05) { r -= 20; g -= 18; b -= 16; }
        }
      }
      const i = (py * Cw + px) * 4;
      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b); d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
