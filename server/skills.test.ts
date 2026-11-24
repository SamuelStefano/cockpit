import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG } from './config';
import { listSkills, parseRisk, readSkill, skillDenyRules, usedByFor } from './skills';
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

describe('parseRisk', () => {
  it('keeps known risks, drops the rest, undefined when none', () => {
    expect(parseRisk('write, net')).toEqual(['write', 'net']);
    expect(parseRisk('[read]')).toEqual(['read']);
    expect(parseRisk('danger')).toBeUndefined();
    expect(parseRisk(undefined)).toBeUndefined();
  });
});

describe('usedByFor', () => {
  it('a bot without a skill list runs everything; a listed bot only what it lists', () => {
    const bots = [{ id: 'a' }, { id: 'b', skills: [] }, { id: 'c', skills: ['pdf'] }, { id: 'd', skills: ['other'] }];
    expect(usedByFor('pdf', bots)).toEqual(['a', 'b', 'c']);
  });
});

describe('listSkills', () => {
  it('adds source, risk and usedBy only when there is something to say', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skills-'));
    for (const [id, fm] of [['plain', 'name: plain'], ['host', 'name: host\nsource: dfl-work\nrisk: write']] as const) {
      await mkdir(join(dir, id));
      await writeFile(join(dir, id, 'SKILL.md'), `---\n${fm}\n---\nbody`);
    }
    const prev = CONFIG.skillsDir;
    (CONFIG as { skillsDir: string }).skillsDir = dir;
    try {
      const without = await listSkills();
      expect(without.find((s) => s.id === 'plain')).toEqual(expect.objectContaining({ id: 'plain' }));
      expect(without.every((s) => s.usedBy === undefined)).toBe(true);
      expect(without.find((s) => s.id === 'plain')?.source).toBeUndefined();
      const withBots = await listSkills([{ id: 'x', skills: ['host'] }]);
      const host = withBots.find((s) => s.id === 'host');
      expect(host).toMatchObject({ source: 'dfl-work', risk: ['write'], usedBy: ['x'] });
      expect(withBots.find((s) => s.id === 'plain')?.usedBy).toEqual([]);
    } finally { (CONFIG as { skillsDir: string }).skillsDir = prev; }
  });
});
