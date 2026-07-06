// Gear-set swap guard — the Set 1 / Set 2 loadout toggle (buttons or the G hotkey)
// instantly re-wears the target loadout. Swapping onto an EMPTY or much-weaker set
// strips your armor, and doing that with foes bearing down is a common accidental
// death (a fat-fingered Set button, or the G hotkey pressed in the heat of a fight).
//
// This pure guard decides when to REFUSE the swap: only while you're genuinely in
// danger AND the target loadout is a real downgrade. When you're safe (town, or no
// threat nearby) every swap is allowed — including onto an empty set, so you can
// still assemble Set 2. And a swap UP (target at least as strong as what you wear)
// is never blocked, so bailing back to your real gear mid-fight always works.
//
// The "in danger" and power readings are gathered at the edge (see toggleGearSet in
// the legacy shell) and injected here so this stays a pure, testable function.

export const GEARSET_RISK_RATIO = 0.5;   // target under half your worn power = risky
export const GEARSET_DANGER_RADIUS = 5;  // a live foe within this many tiles = danger

// Is stepping from `curPower` down to `tgtPower` a dangerous downgrade? Empty target,
// or a drop below RATIO of your current worn power. A stronger/comparable target is
// never risky (you can always gear UP).
export function isRiskySwap(curPower, tgtPower, ratio = GEARSET_RISK_RATIO) {
  if (tgtPower >= curPower) return false;
  return tgtPower === 0 || tgtPower < curPower * ratio;
}

// Should the swap be BLOCKED? Only when in danger and the target is a risky downgrade.
// Returns true to refuse; false to let the swap proceed.
export function blockGearSwap({ inDanger, curPower, tgtPower, ratio = GEARSET_RISK_RATIO } = {}) {
  return !!inDanger && isRiskySwap(curPower, tgtPower, ratio);
}
