// Combat reach tuning. The hero glides continuously (player.fx/fy is the smooth body
// CENTRE) while foes sit on integer tiles, so a strict tile-adjacent melee check felt
// like you had to stand right on top of a foe to hit it — which side of a tile boundary
// your body happened to sit on flipped a hit on or off. MELEE_REACH_BONUS is the extra
// fraction of a tile added to every weapon's tile range when deciding whether a blow
// (auto-attack or a melee-range skill) can land — a half tile of forgiveness so you
// connect a touch before you fully overlap.
//
// It only widens the HIT gate; the tile numbers shown in tooltips / the weapon range
// grid are unchanged. See systems/meleeReach.js for the reach math.
export const MELEE_REACH_BONUS = 0.5;
