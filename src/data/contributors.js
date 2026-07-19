// The people who ship Dungeon Loot, mapped to the two-letter credit badge shown
// in the Version History popup. Pure data — a leaf table, imported by the credit
// helper (src/systems/credit.js) and the version overlay.
//
// A changelog entry's `by` field records the human who DIRECTED the change — never
// the tool. Each maintainer ships Claude-assisted work under their OWN name, so
// `by` is one of the names below (an entry credited to "Claude" is a bug: the tool
// isn't a contributor). `aliases` lists every spelling a person's `by` value or git
// identity can take (display name + GitHub login) so the badge resolves regardless
// of which was recorded.
export const CONTRIBUTORS = [
  { initials: 'JL', name: 'Jeff Louie',    aliases: ['Jeff Louie', 'JeffCLouie', 'jeffclouie'] },
  { initials: 'AS', name: 'Andrew Suiter', aliases: ['Andrew Suiter', 'ASuiter89', 'asuiter89'] },
];

// Badge used when a `by` value matches no known contributor (a legacy entry that
// predates per-person crediting). Kept as 'AS' to preserve the historical
// "everyone who isn't Jeff" bucket.
export const DEFAULT_INITIALS = 'AS';
