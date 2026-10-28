import { describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchGithubTokens, cacheDeadline, credentialOutput, mergeGitConfigEnv, parseCredentialInput, pickToken, tokenUrl, type GithubToken } from './github-app';

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

describe('disk token cache', () => {
  const pem = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const identity = () => ({ agentId: 'ag', privateKeyPem: pem });
  const T0 = Date.parse('2030-01-01T00:00:00Z');
  const setup = (body: unknown = { tokens: [tok('octo')] }, ok = true) => {
    const path = join(mkdtempSync(join(tmpdir(), 'gh-cache-')), 'sub', 'tokens.json');
    const fetchImpl = vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
    return { path, fetchImpl };
  };

  it('writes the cache 0600 and reuses it while fresh', async () => {
    const { path, fetchImpl } = setup();
    expect((await fetchGithubTokens({ now: () => T0, fetchImpl, path, identity }))[0].token).toBe('t-octo');
    expect(statSync(path).mode & 0o777).toBe(0o600);
    await fetchGithubTokens({ now: () => T0 + 60_000, fetchImpl, path, identity });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('refetches once the earliest token is within 5 min of expiry', async () => {
    const { path, fetchImpl } = setup();
    await fetchGithubTokens({ now: () => T0, fetchImpl, path, identity });
    await fetchGithubTokens({ now: () => Date.parse('2030-01-01T00:56:00Z'), fetchImpl, path, identity });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('negative-caches empty answers for 10 min', async () => {
    const { path, fetchImpl } = setup({ tokens: [] });
    await fetchGithubTokens({ now: () => T0, fetchImpl, path, identity });
    expect(JSON.parse(readFileSync(path, 'utf8')).tokens).toEqual([]);
    await fetchGithubTokens({ now: () => T0 + 9 * 60_000, fetchImpl, path, identity });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await fetchGithubTokens({ now: () => T0 + 11 * 60_000, fetchImpl, path, identity });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('negative-caches 4xx and network failures', async () => {
    const a = setup({}, false);
    await fetchGithubTokens({ now: () => T0, fetchImpl: a.fetchImpl, path: a.path, identity });
    await fetchGithubTokens({ now: () => T0 + 1000, fetchImpl: a.fetchImpl, path: a.path, identity });
    expect(a.fetchImpl).toHaveBeenCalledTimes(1);
    const b = setup();
    const boom = vi.fn().mockRejectedValue(new Error('x')) as unknown as typeof fetch;
    expect(await fetchGithubTokens({ now: () => T0, fetchImpl: boom, path: b.path, identity })).toEqual([]);
    await fetchGithubTokens({ now: () => T0 + 1000, fetchImpl: boom, path: b.path, identity });
    expect(boom).toHaveBeenCalledTimes(1);
  });
  it('does not touch the network without an identity', async () => {
    const { path, fetchImpl } = setup();
    expect(await fetchGithubTokens({ now: () => T0, fetchImpl, path, identity: () => null })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
