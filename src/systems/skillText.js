// Pure text transforms for skill descriptions.
//
// A skill's `desc` embeds a `{dmg}` token that the UI normally fills with the
// live per-hit damage range. The skill detail card already surfaces that range
// in its own Damage / DPS readout rows, so repeating the number in the flavour
// line is redundant there. `stripDamageClause` removes the whole `{dmg}` clause
// from a description template, leaving clean prose — e.g.
//   "Swing wide for {dmg}, striking all foes in front of you."
//     → "Swing wide, striking all foes in front of you."
//   "A bleeding strike that deals {dmg}, poisons the target and steals life."
//     → "A bleeding strike that poisons the target and steals life."
//
// Descriptions are hand-authored free text, so the token shows up in a handful
// of grammatical frames (prepositional "for/of {dmg}", predicate "deals/dealing
// {dmg}", infinitive "to deal {dmg}"). Each frame is stripped together with the
// word that joined it so the sentence still reads. Any `{dmg}` in an
// unrecognised frame falls back to the bare word "damage" — never a broken
// `{dmg}` token or a dangling connector left on screen.
export function stripDamageClause(desc) {
  if (!desc) return desc || '';
  let d = desc;
  d = d.replace(/\bthat\s+deals?\s+\{dmg\},\s*(?=\w+ing\b)/gi, '');  // "…that deals {dmg}, <-ing>…"
  d = d.replace(/\s+deals?\s+\{dmg\}\s+and\s+/gi, ' ');             // "deals {dmg} and <verb>"
  d = d.replace(/\s+dealing\s+\{dmg\}\s+and\s+/gi, ' and ');        // "dealing {dmg} and <verb>"
  d = d.replace(/\s+deals?\s+\{dmg\},\s*/gi, ' ');                  // "deals {dmg}, <verb>"
  d = d.replace(/\s+dealing\s+\{dmg\}\s+(?=that\b)/gi, ' ');        // "dealing {dmg} that…"
  d = d.replace(/\s+dealing\s+\{dmg\}(?=[,.])/gi, '');              // "dealing {dmg}[,.]"
  d = d.replace(/\s+to\s+deals?\s+\{dmg\}/gi, '');                  // "to deal {dmg}"
  d = d.replace(/\s+(?:for|of)\s+\{dmg\}/gi, '');                   // "for/of {dmg}"
  d = d.replace(/\{dmg\}/g, 'damage');                              // fallback for novel frames
  return d.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
}
