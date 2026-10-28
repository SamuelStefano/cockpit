import { describe, it, expect } from 'vitest';
import { ALL_PERMISSIONS, botRunsSkill, parsePermissions, parseSkillIds, permissionsFromProfile, profileFromPermissions, toolsDeniedBy, withSkillToggled } from './bot-access';
import { validateBotInput } from './team';

const base = { id: 'capo1', name: 'capo', label: '', instructions: '', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full' };

describe('toolsDeniedBy', () => {
  it('denies nothing when everything is on', () => expect(toolsDeniedBy(ALL_PERMISSIONS)).toEqual([]));
  it('write off', () => expect(toolsDeniedBy({ ...ALL_PERMISSIONS, write: false })).toEqual(['Edit', 'Write', 'NotebookEdit', 'Bash']));
  it('net off', () => expect(toolsDeniedBy({ ...ALL_PERMISSIONS, net: false })).toEqual(['WebFetch', 'WebSearch']));
  it('read off', () => expect(toolsDeniedBy({ ...ALL_PERMISSIONS, read: false })).toEqual(['Read', 'Glob', 'Grep']));
});

describe('profile sync', () => {
  it('maps both ways', () => {
    expect(permissionsFromProfile('restricted')).toEqual({ read: true, write: false, net: true });
    expect(profileFromPermissions({ read: true, write: true, net: false })).toBe('restricted');
  });
});

describe('parsers', () => {
  it('rejects malformed input', () => {
    expect(parsePermissions({ read: true })).toBeNull();
    expect(parseSkillIds(['ok', 'bad id'])).toBeNull();
    expect(parseSkillIds(['a', 'a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('skill toggling', () => {
  const all = ['a', 'b', 'c'];
  it('turning one off from "all" lists the rest', () => expect(withSkillToggled(undefined, all, 'b', false)).toEqual(['a', 'c']));
  it('turning the last one back on returns to "all"', () => expect(withSkillToggled(['a', 'c'], all, 'b', true)).toBeUndefined());
  it('runs everything without a list', () => {
    expect(botRunsSkill({}, 'x')).toBe(true);
    expect(botRunsSkill({ skills: ['a'] }, 'b')).toBe(false);
  });
});

describe('validateBotInput with access fields', () => {
  it('old input without the fields is unchanged', () => {
    const v = validateBotInput(base);
    expect(v.ok && v.bot).toEqual({ ...base });
  });
  it('stores permissions explicitly and keeps profile in sync', () => {
    const v = validateBotInput({ ...base, permissions: { read: true, write: true, net: false }, skills: ['a'] });
    expect(v.ok && v.bot).toMatchObject({ profile: 'restricted', permissions: { read: true, write: true, net: false }, skills: ['a'] });
    const full = validateBotInput({ ...base, profile: 'restricted', permissions: ALL_PERMISSIONS });
    expect(full.ok && full.bot.profile).toBe('full');
  });
  it('rejects malformed fields', () => {
    expect(validateBotInput({ ...base, permissions: { read: 1 } }).ok).toBe(false);
    expect(validateBotInput({ ...base, skills: 'a' }).ok).toBe(false);
  });
});
