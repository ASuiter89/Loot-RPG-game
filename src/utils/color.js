// Pure colour helpers — string in, string out, no globals, no DOM.
// Extracted verbatim from the monolith (see docs/CHANGELOG.md). Used for canvas
// tints, affix aura colours, and glow-sprite gradients.

/**
 * Multiply an `#rrggbb` hex colour's channels by a factor and return `rgb(...)`.
 * Non-hex input is returned unchanged.
 */
export function shadeColor(hex, f) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgb(${Math.round(((n>>16)&255)*f)},${Math.round(((n>>8)&255)*f)},${Math.round((n&255)*f)})`;
}

/**
 * Turn an `#rrggbb` hex colour into `rgba(...)` with the given alpha.
 * Non-hex input is returned unchanged.
 */
export function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

/**
 * Parse any CSS colour we use (rgb/rgba/#rgb/#rrggbb/#rrggbbaa) into
 * `{ rgb: "r,g,b", a: number }`. Unparseable input falls back to opaque white.
 */
export function _parseRGBA(color) {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(color);
  if (m) return { rgb: `${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])}`, a: m[4] == null ? 1 : +m[4] };
  // Hex (#rgb / #rrggbb / #rrggbbaa) — used by affix aura colours.
  const h = /^#([0-9a-f]{3,8})$/i.exec((color || '').trim());
  if (h) {
    let s = h[1];
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
    const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
    return { rgb: `${r},${g},${b}`, a };
  }
  return { rgb: '255,255,255', a: 1 };
}
