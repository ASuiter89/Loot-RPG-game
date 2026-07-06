// Melee / weapon reach — the test that decides whether the hero can actually land a
// blow. The world sim keeps foes on integer tiles (e.x/e.y), but both the hero and the
// foes are drawn at smooth, continuous CENTRES that drift away from those tiles: an
// aggro foe's sprite glides right up against the hero while its logic tile still sits a
// full tile away, and a foe you're chasing lags BEHIND its receding tile. A reach check
// keyed on the logic tiles therefore ignored where things visually are — you had to
// stand right on top of a foe (tile-adjacent) before a swing would connect, even though
// the sprite looked like it was touching you.
//
// This measures from the hero's smooth body CENTRE to the nearest CELL centre of a foe's
// smooth footprint, so reach tracks what you SEE. The caller then adds a small half-tile
// bonus (data/combatReach.js) so a foe within about half a tile of gap still connects.

// Footprint-aware Chebyshev distance from the hero body centre (px, py) to the NEAREST
// cell centre of a foe. (efx, efy) is the foe's smooth footprint CENTRE and `size` its
// tile span, so a lone (size-1) foe's only cell centre is (efx, efy) itself, while a
// size-S boss is measured to whichever of its S×S cell centres is closest. Distances are
// in tile units: a foe whose sprite is one tile away reads ~1.0.
export function footprintReach(px, py, efx, efy, size) {
  const s = size || 1;
  const half = s / 2;
  let best = Infinity;
  for (let dx = 0; dx < s; dx++) for (let dy = 0; dy < s; dy++) {
    // Each cell centre expressed relative to the footprint centre (efx, efy): for s=1
    // the offset is 0, for larger foes it fans out to ±(s-1)/2 around the centre.
    const d = Math.max(Math.abs(efx + (dx + 0.5 - half) - px),
                       Math.abs(efy + (dy + 0.5 - half) - py));
    if (d < best) best = d;
  }
  return best;
}

// Whether that foe is within a weapon of `tileRange` tiles of the hero, given `bonus`
// tiles of reach forgiveness (defaults to 0 for the raw, no-forgiveness reach).
export function inWeaponReach(px, py, efx, efy, size, tileRange, bonus = 0) {
  return footprintReach(px, py, efx, efy, size) <= tileRange + bonus;
}
