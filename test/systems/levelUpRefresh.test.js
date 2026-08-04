import { describe, it, expect } from 'vitest';
import { refreshSkillCooldowns } from '../../src/systems/levelUpRefresh.js';

describe('refreshSkillCooldowns', () => {
  it('hands back an empty map so every skill is ready again', () => {
    const { cooldowns } = refreshSkillCooldowns({ cleave: 4.2, warcry: 18 });
    expect(cooldowns).toEqual({});
  });

  it('counts only the skills that were still running', () => {
    expect(refreshSkillCooldowns({ cleave: 4.2, warcry: 0, bash: 18 }).cleared).toBe(2);
  });

  // Levelling with the whole kit already up is a no-op — the caller uses this to
  // stay quiet rather than announce a refresh that refreshed nothing.
  it('reports nothing cleared when everything was already off cooldown', () => {
    expect(refreshSkillCooldowns({ cleave: 0, warcry: 0 }).cleared).toBe(0);
    expect(refreshSkillCooldowns({}).cleared).toBe(0);
  });

  // A hero who has never cast anything has no map at all (older saves, fresh heroes).
  it('survives a missing or junk map', () => {
    expect(refreshSkillCooldowns(undefined)).toEqual({ cooldowns: {}, cleared: 0 });
    expect(refreshSkillCooldowns(null)).toEqual({ cooldowns: {}, cleared: 0 });
    expect(refreshSkillCooldowns({ cleave: NaN, warcry: 'soon' }).cleared).toBe(0);
  });

  // Never mutates the map it's handed — the caller installs the returned one.
  it('leaves the caller-owned map untouched', () => {
    const live = { cleave: 4.2 };
    const { cooldowns } = refreshSkillCooldowns(live);
    expect(live).toEqual({ cleave: 4.2 });
    expect(cooldowns).not.toBe(live);
  });
});
