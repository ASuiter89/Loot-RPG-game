// Parse the skill trees out of the legacy monolith and reduce them to the set of
// UNIQUE icon keys, each with its class and a representative (prompt) name.
//
// Skill nodes are single-line JSON-ish object literals inside SKILL_TREES, e.g.
//   {"id":"w_a32","name":"Whirlwind","icon":"sk_wa_whirl", ...}
// Multiple skills can share one icon key; we keep the first-seen name as the
// representative and record every name that maps to the key.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { classForIcon } from './colors.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '../../src/legacy/game.js');

export function parseSkillIcons(gamePath = GAME) {
  const src = readFileSync(gamePath, 'utf8');
  const nodes = [];
  for (const raw of src.split('\n')) {
    const t = raw.trim();
    if (!/^\{"id":"[a-z]_[pa]\d\d"/.test(t)) continue;
    const start = t.indexOf('{"id":"');
    let obj = t.slice(start);
    const end = obj.lastIndexOf('}');
    obj = obj.slice(0, end + 1);
    try { nodes.push(JSON.parse(obj)); } catch { /* skip malformed */ }
  }
  const byIcon = new Map();
  for (const n of nodes) {
    if (!n.icon) continue;
    if (!byIcon.has(n.icon)) {
      byIcon.set(n.icon, {
        icon: n.icon, cls: classForIcon(n.icon), name: n.name,
        names: [], ids: [], keystone: false,
      });
    }
    const e = byIcon.get(n.icon);
    e.names.push(n.name);
    e.ids.push(n.id);
    if (n.keystone) e.keystone = true;   // any node on this icon is a keystone
  }
  return { nodes, icons: [...byIcon.values()] };
}

// The text prompt for a given icon's representative name. We ask for a single
// isolated object on a plain white background (so background-removal can cleanly
// strip it) rather than an illustrated scene — a scene has no removable backdrop
// and leaves the subject small inside a full rectangle.
export function iconPrompt(name) {
  return `48x48 pixel art skill icon, no border, a single centered object filling the frame on a plain solid white background, no scenery or landscape.  skill is called ${name}`;
}
