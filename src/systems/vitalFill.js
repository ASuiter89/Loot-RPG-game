// Fluid HP/MP bar fill — one animation frame of the visual fill's motion.
//
// The hero's real HP/MP only change on the world clock (once per ~400ms beat), so a
// bar width copied straight from them would jump once per beat — a visible stair-step.
// Instead the FILL is a separate visual value that moves every animation frame toward
// the hero's current value, so over-time recovery (potions, leech, passive regen)
// climbs on a steady, consistent slope with no per-beat step.
//
// The trick that keeps it smooth: while something is recovering we glide at the LIVE
// recovery rate (points/sec) rather than easing toward a target. Because the fill rises
// at exactly the rate the underlying value rises, it reaches each beat's value right as
// the next beat lands — always moving, never catching up and plateauing. A LOSS (taking
// damage, spending mana) snaps the fill DOWN instantly so hits stay punchy, and a big
// INSTANT gain (an active-cast heal, a level-up refill, a fresh load) snaps UP. Only the
// slow trickle glides. The fill never leads the earned value, so a loss is just
// `cur <= vis` — no prediction to unwind.
//
// Pure math: no DOM, no game state. The caller banks the return value and passes it
// back as `vis` next frame.
//
//   vis      previous frame's eased fill (null → first frame, snap to cur)
//   cur      the hero's current value (player.hp/.mp plus banked sub-point regen)
//   max      the bar maximum (maxHp / maxMp)
//   rate     live recovery rate in points/sec feeding this bar (0 → nothing recovering)
//   dt       real seconds elapsed since the last frame
//   tau      ease time-constant (seconds) for instant sub-burst gains that carry no rate
//   snapFrac a one-frame gain bigger than this share of max is a burst, not a trickle → snap
export function glideVitalFill({ vis, cur, max, rate = 0, dt = 0, tau = 0.14, snapFrac = 0.30 }) {
  if (!(max > 0)) return 0;                                   // no bar → nothing to draw
  cur = Math.max(0, Math.min(max, cur));
  if (vis == null) return cur;                                // first frame → show current
  if (cur <= vis) return cur;                                 // loss (damage / spend) → snap down, punchy
  if (cur - vis > max * snapFrac) return cur;                 // instant burst (heal / refill / load) → snap up
  const step = Math.max(0, dt);
  let next;
  if (rate > 0) {
    next = vis + rate * step;                                 // over-time recovery → steady linear climb
  } else {
    // A small instant gain with no live rate behind it (e.g. a modest active heal):
    // ease toward it quickly so it still reads as smooth rather than stepping.
    next = vis + (cur - vis) * (1 - Math.exp(-step / tau));
  }
  return next > cur ? cur : next;                             // never lead the earned value
}
