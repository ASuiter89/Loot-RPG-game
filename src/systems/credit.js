// Collapse a changelog entry's `by` (the directing human's name/identity) to the
// two-letter credit badge shown in Version History. Pure: matches the CONTRIBUTORS
// table case-insensitively and ignoring surrounding space, and falls back to
// DEFAULT_INITIALS for a name the table doesn't know.
import { CONTRIBUTORS, DEFAULT_INITIALS } from '../data/contributors.js';

export function creditInitials(by, contributors = CONTRIBUTORS, fallback = DEFAULT_INITIALS) {
  if (!by) return fallback;
  const norm = String(by).trim().toLowerCase();
  for (const c of contributors) {
    if (c.aliases.some(a => a.toLowerCase() === norm)) return c.initials;
  }
  return fallback;
}
