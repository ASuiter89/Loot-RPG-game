// Per-spell damage SPREAD — how wide each spell's damage rolls around its center.
//
// A spell used to deal one fixed number. Now it rolls a range: [center·(1−spread),
// center·(1+spread)] (see systems/damageRoll.js → spreadRange). The center is the
// spell's existing computed damage, so average output — and thus balance — is
// unchanged; only the variance is new. `spread` is hand-authored per spell so they
// don't feel samey: a focused magic missile rolls tight, a chaotic meteor rolls wild.
//
// Keyed by skill-node id. Weapon-based skills (and hybrid casts that swing a weapon)
// take their range from the weapon's own min–max and never look here. Any damaging
// spell not listed falls back to DEFAULT_SPELL_SPREAD.

export const DEFAULT_SPELL_SPREAD = 0.15;

export const SPELL_SPREAD = {
  // ── Mage ──────────────────────────────────────────────────────────────────
  m_a00: 0.16, // Firebolt — a plain lick of flame
  m_a01: 0.14, // Frost Shard — a sharp, focused sliver
  m_a02: 0.22, // Spark — crackly and erratic
  m_a03: 0.08, // Arcane Missile — unerring, almost fixed
  m_a11: 0.18, // Frost Nova
  m_a12: 0.28, // Chain Spark — jumps unpredictably
  m_a13: 0.16, // Arcane Blast
  m_a20: 0.22, // Fireball
  m_a21: 0.10, // Ice Prison — a controlled, reliable lock
  m_a22: 0.24, // Voltaic Bolt
  m_a23: 0.12, // Arcane Orb — heavy and steady
  m_a30: 0.24, // Flame Wave
  m_a31: 0.35, // Blizzard — a churning storm
  m_a32: 0.38, // Thunderstorm — wild arcs
  m_a33: 0.12, // Disintegrate — a steady beam
  m_a40: 0.33, // Firestorm — rains chaotically
  m_a41: 0.20, // Ice Age
  m_a42: 0.40, // Storm Call — a scattershot barrage
  m_a50: 0.45, // Meteor — colossal and swingy
  m_a51: 0.18, // Absolute Zero
  m_a52: 0.42, // Apocalypse — a cataclysm
  m_a53: 0.06, // Disintegration Ray — perfected, near-fixed (always crits)

  // ── Templar (holy) ──────────────────────────────────────────────────────────
  t_a04: 0.14, // Holy Bolt
  t_a14: 0.20, // Holy Fire
  t_a22: 0.22, // Condemn
  t_a23: 0.16, // Consecrate
  t_a24: 0.12, // Judgment — precise and unwavering
  t_a32: 0.18, // Holy Ground
  t_a34: 0.22, // Wrath of Heaven
  t_a43: 0.20, // Holy Nova
  t_a44: 0.12, // Sunbeam — a steady channel
  t_a53: 0.18, // Light of Heaven
  t_a54: 0.30, // Judgment Day — a cataclysm of holy fire
};

/** Spread fraction for a spell node, falling back to the default for anything unlisted. */
export function spellSpreadFor(id) {
  return (id != null && SPELL_SPREAD[id] != null) ? SPELL_SPREAD[id] : DEFAULT_SPELL_SPREAD;
}
