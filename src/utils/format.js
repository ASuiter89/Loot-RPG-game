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
 * magnitude suffix above — one decimal below ten of a unit (1.2k), whole above
 * (12k). Handles negatives and non-finite input (→ "0").
 * @param {number} n
 * @returns {string}
 */
export function abbreviateNumber(n) {
  if (!Number.isFinite(n)) return '0';
  const neg = n < 0;
  const v = Math.abs(n);
  let out;
  if (v < 1000) {
    out = String(Math.round(v));
  } else {
    out = String(Math.round(v)); // fallback (shouldn't be reached: 1e12 covers it)
    for (const [div, suf] of MAGNITUDES) {
      if (v >= div) {
        const q = v / div;
        out = (q < 10 ? trimZero(q.toFixed(1)) : String(Math.round(q))) + suf;
        break;
      }
    }
  }
  return neg ? '-' + out : out;
}

/**
 * Format a low–high damage span with an en dash, abbreviating each end. When the
 * two ends collapse to the same abbreviated value (e.g. a fixed-damage spell, or a
 * tight range that rounds together) a single number is shown instead of "N–N".
 * @param {number} min
 * @param {number} max
 * @returns {string}
 */
export function formatDamageRange(min, max) {
  const lo = abbreviateNumber(min);
  const hi = abbreviateNumber(max);
  return lo === hi ? lo : `${lo}–${hi}`;
}
