// Silhouette tint colours — used when an actor walks BEHIND a tall decor object
// (a tree, a wardrobe) and the game stamps a flat, see-through silhouette of them
// over the covering sprite so a half-hidden hero/foe stays trackable.
//
// The hero's silhouette reads as their CLASS colour so you can tell at a glance
// who is hidden: Warrior red · Mage yellow · Templar blue · Rogue green ·
// Fortune-Seeker violet · Windblade teal · Bloodletter crimson. Enemies get a
// distinct magenta so a hidden foe never blurs into any of them.
// These are bespoke gameplay-readability colours (canvas art), not UI tokens.

export const HERO_SILHOUETTE_TINT = {
  warrior: 'rgba(230,70,70,0.9)',   // red
  mage:    'rgba(240,214,74,0.9)',  // yellow
  templar: 'rgba(86,148,255,0.9)',  // blue
  rogue:   'rgba(90,208,120,0.9)',  // green
  fortune:     'rgba(192,140,232,0.9)', // violet
  windblade:   'rgba(95,214,200,0.9)',  // teal
  bloodletter: 'rgba(208,58,75,0.9)',   // crimson
};

// Fallback tint for a hero with no class chosen yet (character-creation preview).
export const HERO_SILHOUETTE_TINT_DEFAULT = 'rgba(150,220,255,0.9)';

// Enemy silhouette — deliberately unlike any hero class colour.
export const ENEMY_SILHOUETTE_TINT = 'rgba(198,84,224,0.9)'; // magenta

// Resolve a hero's silhouette tint from their class key.
export function heroSilhouetteTint(cls) {
  return HERO_SILHOUETTE_TINT[cls] || HERO_SILHOUETTE_TINT_DEFAULT;
}
