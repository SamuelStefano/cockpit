import { describe, it, expect } from 'vitest';
import { readSkill, skillDenyRules } from './skills';
import type { SkillMeta } from '../shared/protocol';

const mk = (id: string, name = id): SkillMeta => ({ id, name, description: '', mtime: 0 });
const ALL = [mk('dfl-stack'), mk('squad-review'), mk('webapp-testing')];

describe('readSkill', () => {
  it('rejects traversal and otherwise invalid slugs before any disk read', async () => {
    for (const bad of ['../etc', 'a/b', '.', '..', 'foo.md', 'foo bar', '', 'x'.repeat(81)]) {
      expect(await readSkill(bad)).toBeNull();
    }
  });

  it('returns null for a well-formed slug that does not exist', async () => {
    expect(await readSkill('definitely-not-a-real-skill-xyz')).toBeNull();
  });
});

describe('skillDenyRules', () => {
  it('denies nothing when the selection is empty (all skills active)', () => {
    expect(skillDenyRules([], ALL)).toEqual([]);
    expect(skillDenyRules(undefined, ALL)).toEqual([]);
  });

  it('denies every skill outside the selection', () => {
    const rules = skillDenyRules(['dfl-stack'], ALL);
    expect(rules).toContain('Skill(squad-review)');
    expect(rules).toContain('Skill(webapp-testing)');
    expect(rules).not.toContain('Skill(dfl-stack)');
  });

  it('emits Skill(name) too when name differs and is a clean slug', () => {
    const all = [mk('a', 'alpha'), mk('b', 'beta')];
    const rules = skillDenyRules(['a'], all);
    expect(rules).toContain('Skill(b)');
    expect(rules).toContain('Skill(beta)');
  });

  it('skips name with spaces (would break the space-joined arg)', () => {
    const all = [mk('keep'), mk('drop', 'drop me now')];
    const rules = skillDenyRules(['keep'], all);
    expect(rules).toEqual(['Skill(drop)']);
  });

  it('selecting all known skills denies none of them', () => {
    expect(skillDenyRules(ALL.map((s) => s.id), ALL)).toEqual([]);
  });
});
