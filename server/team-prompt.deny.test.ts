import { describe, it, expect, vi } from 'vitest';

vi.mock('./skills', () => ({ resolveSkillDeny: vi.fn(async (sel?: string[]) => (sel?.length ? ['Skill(other)'] : [])) }));

import { botDenyRules } from './team-prompt';

describe('botDenyRules', () => {
  it('no fields: nothing denied', async () => {
    expect(await botDenyRules({})).toEqual([]);
    expect(await botDenyRules(undefined)).toEqual([]);
  });
  it('each toggle yields its exact tool list', async () => {
    expect(await botDenyRules({ permissions: { read: true, write: false, net: true } })).toEqual(['Edit', 'Write', 'NotebookEdit', 'Bash']);
    expect(await botDenyRules({ permissions: { read: true, write: true, net: false } })).toEqual(['WebFetch', 'WebSearch']);
    expect(await botDenyRules({ permissions: { read: false, write: true, net: true } })).toEqual(['Read', 'Glob', 'Grep']);
  });
  it('adds skills outside the list', async () => {
    expect(await botDenyRules({ skills: ['a'], permissions: { read: true, write: false, net: true } })).toEqual(['Edit', 'Write', 'NotebookEdit', 'Bash', 'Skill(other)']);
  });
});
