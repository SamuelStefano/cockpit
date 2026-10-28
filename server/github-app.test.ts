import { describe, expect, it } from 'vitest';
import { cacheDeadline, credentialOutput, mergeGitConfigEnv, parseCredentialInput, pickToken, tokenUrl, type GithubToken } from './github-app';

const tok = (login: string, token = `t-${login}`): GithubToken => ({ account_login: login, token, expires_at: '2030-01-01T01:00:00Z' });

describe('credential protocol', () => {
  it('parses key=value lines', () => {
    expect(parseCredentialInput('protocol=https\nhost=github.com\npath=Octo/repo.git\n\n')).toEqual({ protocol: 'https', host: 'github.com', path: 'Octo/repo.git' });
  });
  it('matches owner case-insensitively', () => {
    const f = { protocol: 'https', host: 'github.com', path: 'OCTO/repo.git' };
    expect(pickToken(f, [tok('other'), tok('octo')])?.token).toBe('t-octo');
  });
  it('falls back to the only token, but not among several', () => {
    const f = { protocol: 'https', host: 'github.com', path: 'x/y' };
    expect(pickToken(f, [tok('octo')])?.token).toBe('t-octo');
    expect(pickToken(f, [tok('a'), tok('b')])).toBeNull();
  });
  it('ignores other hosts and empty token lists', () => {
    expect(pickToken({ protocol: 'https', host: 'gitlab.com', path: 'a/b' }, [tok('a')])).toBeNull();
    expect(credentialOutput({ protocol: 'https', host: 'github.com', path: 'a/b' }, [])).toBe('');
  });
  it('prints the git credential answer', () => {
    expect(credentialOutput({ protocol: 'https', host: 'github.com', path: 'a/b' }, [tok('a')])).toBe('username=x-access-token\npassword=t-a\n');
  });
});

describe('env and cache helpers', () => {
  it('appends to an existing GIT_CONFIG_COUNT', () => {
    const out = mergeGitConfigEnv({ GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'a', GIT_CONFIG_VALUE_0: 'b' }, [['k1', 'v1'], ['k2', 'v2']]);
    expect(out).toMatchObject({ GIT_CONFIG_COUNT: '3', GIT_CONFIG_KEY_0: 'a', GIT_CONFIG_KEY_1: 'k1', GIT_CONFIG_VALUE_2: 'v2' });
  });
  it('starts at zero without a count', () => {
    expect(mergeGitConfigEnv({}, [['k', 'v']])).toMatchObject({ GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'k', GIT_CONFIG_VALUE_0: 'v' });
  });
  it('expires the cache 5 min before the earliest token', () => {
    const a = { ...tok('a'), expires_at: '2030-01-01T01:00:00Z' };
    const b = { ...tok('b'), expires_at: '2030-01-01T00:30:00Z' };
    expect(cacheDeadline([a, b])).toBe(Date.parse('2030-01-01T00:25:00Z'));
  });
  it('defaults the supabase url', () => {
    expect(tokenUrl({})).toBe('https://ikxtdssxmcgipyfpwmar.supabase.co/functions/v1/github-app/token');
    expect(tokenUrl({ DECK_SUPABASE_URL: 'http://x/' })).toBe('http://x/functions/v1/github-app/token');
  });
});
