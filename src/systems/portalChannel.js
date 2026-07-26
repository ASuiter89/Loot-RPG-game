// Town-portal CHANNEL resolution — the pure per-tick decision behind the retreat.
//
// Opening a town portal isn't instant: the gate CHANNELS for a few clean real
// seconds on the world clock, and any foe/hazard blow that lands mid-channel
// shatters it. This module owns just that decision — given the channel state and
// what happened to the hero during this tick's foe/hazard phase, it says what the
// channel should DO — while the caller in the game loop owns the side effects
// (logging the break, playing SFX, kicking off the beam-up). No game globals, so
// the rule stays deterministic and unit-testable.
//
// The break rule is "any landed blow cancels it", NOT "any HP loss cancels it": a
// hit a shield (Spirit Veil, a barrier buff, mana shield) fully soaks still lands,
// so `struck` shatters the channel independently of whether HP actually dropped.

// Resolve one world-tick of a channeling town portal.
//   charge     seconds of channel LEFT before the gate opens (≤0 = not channeling)
//   hpBefore   hero HP at the START of the foe/hazard phase this tick
//   hpNow      hero HP after foes/hazards acted
//   struck     did a foe/hazard blow LAND this tick — even one a shield fully soaked?
//   tickSecs   world-tick length in seconds (the channel counts down by this)
// Returns { action, charge } where action is:
//   'idle'    — not channeling; nothing to do
//   'death'   — a killing blow landed; death takes over, wipe the channel silently
//   'shatter' — a blow landed (or HP dropped); collapse the channel with a log/SFX
//   'open'    — the channel completed cleanly; begin the beam-up to town
//   'tick'    — still channeling; `charge` is the seconds left after this tick
export function portalChannelStep({ charge, hpBefore, hpNow, struck, tickSecs }) {
  if (!(charge > 0)) return { action: 'idle', charge: 0 };
  if (hpNow <= 0) return { action: 'death', charge: 0 };            // a killing blow — death takes over
  if (struck || hpNow < hpBefore) return { action: 'shatter', charge: 0 };
  const left = charge - tickSecs;
  if (left <= 0) return { action: 'open', charge: 0 };              // channel complete
  return { action: 'tick', charge: left };                         // still charging
}
