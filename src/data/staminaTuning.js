// Stamina economy — the dials that decide how long you can sprint, how fast the
// pool comes back, and what a dash costs. Pure data: no logic, no imports. The
// legacy shell reads these into its MAX_STAMINA / SPRINT_DRAIN / STAM_REGEN /
// STAM_DELAY / DASH_COST constants, and gameGuide('movement') quotes them, so the
// numbers a player is told always match the numbers the simulation runs.
//
// How the three numbers interact (baseline hero, no Vitality or gear bonus):
//   • sprint window from full  = max / sprintDrain          → 5.0s
//   • empty → full             = regenDelay + max/regenPerSec → 3.9s
//   • sustained sprint uptime  = sprint / (sprint + refill)   → ~56%
//   • dashes from a full pool  = floor(max / dashCost)        → 2
//   • sustained dash cadence   = regenDelay + dashCost/regenPerSec → 2.1s
//
// Tuning history: sprint used to drain 34/s against a 22/s refill, which bought a
// 2.9s sprint followed by a 5.2s wait — a 36% uptime that made Shift feel like a
// cooldown rather than a stride. Draining slower and refilling faster makes SPRINT
// the sustainable traversal tool; DASH pays for that (35 → 45) so the burst escape
// stays exactly as scarce as it was — the faster refill is spent on running, not on
// dash-spamming. Vitality and the STAM/STAMREG gear stats add on top of these.
export const STAMINA = {
  max: 100,          // baseline pool before Vitality / gear
  sprintDrain: 20,   // stamina/sec while sprinting (dungeon only — town sprint is free)
  regenPerSec: 30,   // stamina/sec refill once the exertion pause has run out
  regenDelay: 0.6,   // seconds after exerting before the refill starts
  dashCost: 45,      // stamina per dash
};
