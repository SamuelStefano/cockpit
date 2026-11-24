import { describe, it, expect } from 'vitest';
import { ALL_PERMS, disallowedTools, permsFromProfile, profileFromPerms } from './perms';

describe('agent permissions', () => {
  it('maps a full profile to everything on and a restricted one to read + net', () => {
    expect(permsFromProfile('full')).toEqual(ALL_PERMS);
    expect(permsFromProfile('restricted')).toEqual({ read: true, write: false, net: true });
  });

  it('stays full only while every permission is on', () => {
    expect(profileFromPerms(ALL_PERMS)).toBe('full');
    expect(profileFromPerms({ ...ALL_PERMS, write: false })).toBe('restricted');
    expect(profileFromPerms({ ...ALL_PERMS, net: false })).toBe('restricted');
  });

  it('denies file-changing tools without Escrever and web tools without Rede', () => {
    expect(disallowedTools(ALL_PERMS)).toEqual([]);
    expect(disallowedTools({ ...ALL_PERMS, write: false })).toEqual(['Edit', 'Write', 'NotebookEdit', 'Bash']);
    expect(disallowedTools({ ...ALL_PERMS, net: false })).toEqual(['WebFetch', 'WebSearch']);
    expect(disallowedTools({ read: false, write: true, net: true })).toEqual(['Read', 'Glob', 'Grep']);
  });

  it('round-trips a restricted profile', () => {
    expect(profileFromPerms(permsFromProfile('restricted'))).toBe('restricted');
  });
});
