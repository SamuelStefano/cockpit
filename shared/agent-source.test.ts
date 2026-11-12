import { describe, expect, it } from 'vitest';
import { validateAgentSource } from './agent-source';

describe('validateAgentSource', () => {
  it('accepts owner/name and a nested folder', () => {
    expect(validateAgentSource({ repo: 'devfellowship/agents', path: 'team/maria/' })).toEqual({ ok: true, source: { repo: 'devfellowship/agents', path: 'team/maria' } });
  });

  it('normalizes a pasted GitHub URL and an empty folder', () => {
    expect(validateAgentSource({ repo: 'https://github.com/a/b.git', path: '' })).toEqual({ ok: true, source: { repo: 'a/b', path: '' } });
  });

  it.each(['../etc', 'a/../../x', './a', 'a\\b', 'a/ b', 'a/.'])('rejects folder %s', (path) => {
    expect(validateAgentSource({ repo: 'a/b', path }).ok).toBe(false);
  });

  it.each(['', 'a', 'a/b/c', '../b', 'a/..', '-a/b', 'a b/c', 'git@github.com:a/b'])('rejects repo %s', (repo) => {
    expect(validateAgentSource({ repo, path: '' }).ok).toBe(false);
  });

  it('strips a leading slash instead of treating it as absolute', () => {
    expect(validateAgentSource({ repo: 'a/b', path: '/maria' })).toEqual({ ok: true, source: { repo: 'a/b', path: 'maria' } });
  });
});
