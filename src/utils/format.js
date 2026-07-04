// Compact number formatting for the HUD and tooltips. Pure, dependency-free.
//
// Big numbers (skill DPS on a deep floor, damage ranges under heavy gear) would
// overflow a tooltip line if printed in full, so anything past a thousand is
// abbreviated with a magnitude suffix (1.2k, 3.4M, 1.1B). Small values print
// exactly. Mirrors the shape of the legacy `fmtGold` helper so the two read alike.

const MAGNITUDES = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']];

/** Drop a trailing ".0" so 1.0 → "1" but 1.2 stays "1.2". */
function trimZero(s) {
  return s.replace(/\.0$/, '');
}

/**
 * Abbreviate a number for a compact readout: exact (rounded) under 1000, then a
 * magnitude suffix above. By default one decimal below ten of a unit (1.2k), whole
 * above (12k). Pass `decimals` to force that many decimals on the magnitude part
 * (e.g. 2 → "32.14k") — used to reveal a narrow range whose ends round together.
 * Handles negatives and non-finite input (→ "0").
 * @param {number} n
 * @param {number} [decimals] forced decimal places on the abbreviated magnitude
 * @returns {string}
 */
export function abbreviateNumber(n, decimals) {
  if (!Number.isFinite(n)) return '0';
  const neg = n < 0;
  const v = Math.abs(n);
  let out;
  if (v < 1000) {
    out = decimals != null ? v.toFixed(decimals) : String(Math.round(v));
  } else {
    out = String(Math.round(v)); // fallback (shouldn't be reached: 1e12 covers it)
    for (const [div, suf] of MAGNITUDES) {
      if (v >= div) {
        const q = v / div;
        out = (decimals != null
          ? q.toFixed(decimals)
          : (q < 10 ? trimZero(q.toFixed(1)) : String(Math.round(q)))) + suf;
        break;
      }
    }
  }
  return neg ? '-' + out : out;
}

/**
 * Format a low–high damage span with an en dash, abbreviating each end. Always
 * shows both ends when they differ — if the default abbreviation rounds them to the
 * same string (a narrow range at a big magnitude, e.g. 32000–32400), it adds decimal
 * precision until the two read as distinct ("32.0k–32.4k"). A true point (min ===
 * max, e.g. a fixed-damage spell) shows a single number.
 * @param {number} min
 * @param {number} max
 * @returns {string}
 */
export function formatDamageRange(min, max) {
  if (min === max) return abbreviateNumber(min);
  const lo0 = abbreviateNumber(min), hi0 = abbreviateNumber(max);
  if (lo0 !== hi0) return `${lo0}–${hi0}`;
  // Ends round to the same abbreviation — sharpen precision until they separate.
  for (let d = 1; d <= 2; d++) {
    const lo = abbreviateNumber(min, d), hi = abbreviateNumber(max, d);
    if (lo !== hi) return `${lo}–${hi}`;
  }
  return lo0; // indistinguishable even at 2 decimals — effectively a point
}

/**
 * Abbreviate every run of four or more digits (i.e. 1000+) inside a string,
 * leaving shorter numbers, symbols, labels and markup untouched. Used for on-screen
 * floating combat text so a deep-floor hit or a fat gold drop reads "12.3k" instead
 * of a wall of digits, while pop-ups like "BLOCK", "2×250" or "+50 MP" keep their
 * prefix/suffix. Non-string input is returned unchanged.
 * @param {string} text
 * @returns {string}
 */
export function abbreviateNumbersIn(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\d{4,}/g, (run) => abbreviateNumber(Number(run)));
}
