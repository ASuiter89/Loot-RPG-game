// Pure number-formatting helpers — value in, string out, no globals, no DOM.

/**
 * Compact a number to short form once it reaches 1000: `1200 → "1.2k"`,
 * `1_500_000 → "1.5m"`. Values under 1000 are returned as-is. Keeps at most one
 * decimal (dropped when whole), and switches to no decimals past 100 of a unit so
 * floaters stay short (`123456 → "123k"`). Negatives and the sign are preserved;
 * non-finite input is stringified untouched.
 */
export function shortNum(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  const a = Math.abs(num);
  if (a < 1000) return String(num);
  const sign = num < 0 ? '-' : '';
  const units = [['b', 1e9], ['m', 1e6], ['k', 1e3]];
  for (const [suffix, div] of units) {
    if (a >= div) {
      const v = a / div;
      const r = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
      return sign + r + suffix;
    }
  }
  return String(num);
}

/**
 * Replace every run of 4+ digits (i.e. any value ≥ 1000) inside a string with its
 * {@link shortNum} short form, leaving surrounding text (signs, words, symbols)
 * intact: `"+1523"` → `"+1.5k"`, `"BLOCK 1200"` → `"BLOCK 1.2k"`.
 */
export function abbrevNums(text) {
  return String(text).replace(/\d{4,}/g, (m) => shortNum(Number(m)));
}
