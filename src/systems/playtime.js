// Play-time billing rule — pure, no clock/DOM/state (the caller observes the flags).
//
// A once-a-second heartbeat produces a raw wall-clock delta; this splits it between the
// game's TWO play-time counters, which bill on two different gates:
//
//  • wallMs   → the account-wide "Total time played" lifetime counter (hcMeta.pt), shown
//    in the History header. Billed for ALL foreground time — every second the game is
//    open and visible, whether or not keys are being pressed (menus, planning, reading).
//  • activeMs → the per-hero playMs, which is ALSO the cross-device conflict signal
//    (saveOrder picks the copy with more play-time). Billed only while ACTIVELY played
//    (recent input, tab visible), so a tab merely left open can't inflate a hero's
//    play-time and out-rank the device you actually played on. Clock-skew-proof by
//    construction — a stale open tab never wins a merge on billed-but-idle seconds.
//
// The raw delta is clamped first: a negative delta (wall clock moved back) counts as 0,
// and an oversized delta (the tab was throttled or the machine slept, so the timer
// fired late) counts as a single nominal tick instead of dumping the whole gap.
export function splitPlayTick({ dtMs, hidden, active, maxTickMs = 5000, nominalMs = 1000 }) {
  let dt = dtMs;
  if (!(dt > 0)) dt = 0;
  else if (dt > maxTickMs) dt = nominalMs;
  if (hidden) return { wallMs: 0, activeMs: 0 }; // tab backgrounded — nothing counts
  return { wallMs: dt, activeMs: active ? dt : 0 };
}
