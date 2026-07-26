// ── DROPPED-FOOD RESTORE ─────────────────────────────────────────────────────
// A snack scooped off the floor refuels the hero — but it hits Stamina hardest.
// HP and MP top up by the food's flat `heal` value; Stamina instead restores a big
// PERCENTAGE of the hero's MAX stamina (a hearty gulp of energy), so grabbing food
// is the go-to way to refill the sprint/dash pool between fights.
//
// Pure: given each pool's current/max and the food's flat restore amount, return
// the clamped gain per pool — never more than the room left, never negative — so
// the caller can both add it and show it. Missing/undefined pools (a legacy save
// with no stamina, say) read as 0 and simply yield no gain.

// Fraction of MAX stamina a single bite restores. At the base 100-stamina pool
// that's ~50 per snack — well above any food's flat heal (7–28) — and it scales up
// automatically as Vitality/gear deepen the pool.
export const FOOD_STAMINA_FRACTION = 0.5;

export function foodGains(pools, amount, staminaFraction = FOOD_STAMINA_FRACTION) {
  const amt = Math.max(0, amount || 0);
  const frac = Math.max(0, staminaFraction || 0);
  // Stamina gets the LARGER of the flat food amount or a slice of MAX stamina, so a
  // bite always refuels Stamina far more than HP/MP.
  const staminaAmt = Math.max(amt, (pools.maxStamina || 0) * frac);
  const gain = (cur, max, give) => Math.max(0, Math.min(give, (max || 0) - (cur || 0)));
  return {
    hp: gain(pools.hp, pools.maxHp, amt),
    mp: gain(pools.mp, pools.maxMp, amt),
    stamina: gain(pools.stamina, pools.maxStamina, staminaAmt),
  };
}
