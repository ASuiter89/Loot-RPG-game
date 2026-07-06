// ── DROPPED-FOOD RESTORE ─────────────────────────────────────────────────────
// A snack scooped off the floor nourishes the WHOLE hero: the same bite tops up
// HP, MP and Stamina alike (food's `heal` value is the amount for each pool).
//
// Pure: given each pool's current/max and the food's restore amount, return the
// clamped gain per pool — never more than the room left, never negative — so the
// caller can both add it and show it. Missing/undefined pools (a legacy save with
// no stamina, say) read as 0 and simply yield no gain.
export function foodGains(pools, amount) {
  const amt = Math.max(0, amount || 0);
  const gain = (cur, max) => Math.max(0, Math.min(amt, (max || 0) - (cur || 0)));
  return {
    hp: gain(pools.hp, pools.maxHp),
    mp: gain(pools.mp, pools.maxMp),
    stamina: gain(pools.stamina, pools.maxStamina),
  };
}
