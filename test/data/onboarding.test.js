import { describe, it, expect } from 'vitest';
import {
  RAMP_FLOOR, SKILL_SLOT_RAMP, HAZARD_INTRO_FLOOR, EARLY_RELIEF, EARLY_PACK_CAP,
  HINTS, KEEPER_INTRO, KEEPER_INTRO_FLOOR, STARTER_STEPS, TIPS, DEATH_TIPS,
} from '../../src/data/onboarding.js';
import { WIKI, wikiArticles } from '../../src/data/wiki.js';

const ARTICLE_IDS = new Set(wikiArticles(WIKI).map(w => w.article.id));

describe('onboarding schedule validity', () => {
  it('every RAMP_FLOOR gate is a positive integer', () => {
    for (const [k, v] of Object.entries(RAMP_FLOOR)) {
      expect(Number.isInteger(v), k).toBe(true);
      expect(v, k).toBeGreaterThan(0);
    }
  });

  it('the skill-slot ramp is ascending in both floor and slot count, capped at 4', () => {
    expect(Array.isArray(SKILL_SLOT_RAMP)).toBe(true);
    expect(SKILL_SLOT_RAMP[0][0]).toBe(1); // a floor-1 baseline always exists
    for (let i = 1; i < SKILL_SLOT_RAMP.length; i++) {
      expect(SKILL_SLOT_RAMP[i][0]).toBeGreaterThan(SKILL_SLOT_RAMP[i - 1][0]);
      expect(SKILL_SLOT_RAMP[i][1]).toBeGreaterThanOrEqual(SKILL_SLOT_RAMP[i - 1][1]);
    }
    expect(SKILL_SLOT_RAMP[SKILL_SLOT_RAMP.length - 1][1]).toBe(4);
  });

  it('hazard intro floors are positive integers', () => {
    for (const [k, v] of Object.entries(HAZARD_INTRO_FLOOR)) {
      expect(Number.isInteger(v), k).toBe(true);
      expect(v, k).toBeGreaterThan(0);
    }
  });

  it('early relief multipliers are ≤ 1 and rise toward full strength', () => {
    const floors = Object.keys(EARLY_RELIEF).map(Number).sort((a, b) => a - b);
    let prev = 0;
    for (const f of floors) {
      expect(EARLY_RELIEF[f], `floor ${f}`).toBeLessThanOrEqual(1);
      expect(EARLY_RELIEF[f], `floor ${f}`).toBeGreaterThan(0);
      expect(EARLY_RELIEF[f], `floor ${f} rises`).toBeGreaterThan(prev);
      prev = EARLY_RELIEF[f];
    }
  });

  it('early pack caps are positive integers', () => {
    for (const [k, v] of Object.entries(EARLY_PACK_CAP)) {
      expect(Number.isInteger(v), k).toBe(true);
      expect(v, k).toBeGreaterThan(0);
    }
  });
});

describe('teaching copy validity', () => {
  it('every hint has non-empty text', () => {
    for (const [id, h] of Object.entries(HINTS)) {
      expect(typeof h.text, id).toBe('string');
      expect(h.text.trim().length, id).toBeGreaterThan(0);
    }
  });

  it('every hint is one short, glanceable sentence', () => {
    // A ramp chip is glanced, not read — keep each to a single short sentence. Strip
    // the inline <b>/<span> markup, then cap the visible length and allow at most one
    // sentence terminator (so a "…tab. Some shrines cost Health." two-sentence chip
    // fails). The "Learn more ›" link carries any extra detail.
    for (const [id, h] of Object.entries(HINTS)) {
      const visible = h.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      expect(visible.length, `hint ${id} too long (${visible.length} chars): ${visible}`).toBeLessThanOrEqual(90);
      const enders = (visible.match(/[.!?]/g) || []).length;
      expect(enders, `hint ${id} is more than one sentence: ${visible}`).toBeLessThanOrEqual(1);
    }
  });

  it('every hint "learn more" target is a real wiki article', () => {
    for (const [id, h] of Object.entries(HINTS)) {
      if (h.wiki) expect(ARTICLE_IDS.has(h.wiki), `hint ${id} → wiki ${h.wiki}`).toBe(true);
    }
  });

  it('every keeper intro has a title, text and a real wiki target', () => {
    for (const [kind, info] of Object.entries(KEEPER_INTRO)) {
      expect(typeof info.title, kind).toBe('string');
      expect(info.title.trim().length, kind).toBeGreaterThan(0);
      expect(typeof info.text, kind).toBe('string');
      expect(info.text.trim().length, kind).toBeGreaterThan(0);
      expect(ARTICLE_IDS.has(info.wiki), `keeper ${kind} → wiki ${info.wiki}`).toBe(true);
    }
  });

  it('every keeper intro has a corresponding intro floor', () => {
    for (const kind of Object.keys(KEEPER_INTRO)) {
      expect(KEEPER_INTRO_FLOOR[kind], kind).toBeGreaterThan(0);
    }
  });

  it('starter steps each have a unique id and a label', () => {
    const ids = new Set();
    for (const s of STARTER_STEPS) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.label).toBe('string');
      expect(ids.has(s.id), `dup ${s.id}`).toBe(false);
      ids.add(s.id);
    }
    expect(STARTER_STEPS.length).toBeGreaterThanOrEqual(2);
  });

  it('tips and death tips are non-empty strings', () => {
    expect(TIPS.length).toBeGreaterThan(3);
    for (const t of TIPS) {
      expect(typeof t).toBe('string');
      expect(t.trim().length).toBeGreaterThan(0);
    }
    for (const [cause, t] of Object.entries(DEATH_TIPS)) {
      expect(typeof t, cause).toBe('string');
      expect(t.trim().length, cause).toBeGreaterThan(0);
    }
  });

  it('no teaching copy references another game (project copy rule)', () => {
    const banned = /diablo|roguelike|golden sun|dark souls|zelda|nethack|hades/i;
    const all = [
      ...Object.values(HINTS).map(h => h.text),
      ...Object.values(KEEPER_INTRO).map(k => k.title + ' ' + k.text),
      ...TIPS,
      ...Object.values(DEATH_TIPS),
    ];
    for (const s of all) expect(banned.test(s), s).toBe(false);
  });
});
