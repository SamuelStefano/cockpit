import { describe, it, expect } from 'vitest';
import { mcpInfoFrom, parseSshHosts, tokenEnvNames, parseTmuxList, parseWhich } from './health';

describe('mcpInfoFrom', () => {
  it('extracts name + transport from .claude.json, never the secret payload', () => {
    const raw = JSON.stringify({
      mcpServers: {
        infisical: { type: 'stdio', command: 'infi', env: { TOKEN: 'super-secret' } },
        miro: { type: 'sse', url: 'https://mcp.miro.com' },
      },
    });
    const out = mcpInfoFrom(raw);
    expect(out).toEqual([
      { name: 'infisical', transport: 'stdio' },
      { name: 'miro', transport: 'sse' },
    ]);
    expect(JSON.stringify(out)).not.toContain('super-secret');
  });

  it('infers transport when type is absent', () => {
    const raw = JSON.stringify({ mcpServers: { a: { command: 'x' }, b: { url: 'http://y' }, c: {} } });
    expect(mcpInfoFrom(raw)).toEqual([
      { name: 'a', transport: 'stdio' },
      { name: 'b', transport: 'http' },
      { name: 'c', transport: 'unknown' },
    ]);
  });

  it('returns [] on empty or malformed json', () => {
    expect(mcpInfoFrom('')).toEqual([]);
    expect(mcpInfoFrom('{not json')).toEqual([]);
    expect(mcpInfoFrom('{}')).toEqual([]);
  });
});

describe('parseSshHosts', () => {
  it('collects Host aliases, drops wildcards and dups', () => {
    const cfg = [
      'Host vps prod',
      '  HostName 1.2.3.4',
      '  IdentityFile ~/.ssh/id_ed25519',
      'Host *',
      '  ForwardAgent yes',
      'Host vps',
    ].join('\n');
    expect(parseSshHosts(cfg)).toEqual(['vps', 'prod']);
  });

  it('returns [] on empty config', () => {
    expect(parseSshHosts('')).toEqual([]);
  });
});

describe('tokenEnvNames', () => {
  it('returns NAMES of token-like vars, never values, sorted', () => {
    const env = {
      ANTHROPIC_API_KEY: 'sk-secret',
      GITHUB_TOKEN: 'ghp_secret',
      DB_PASSWORD: 'pw',
      PATH: '/usr/bin',
      HOME: '/home/samuel',
    };
    const out = tokenEnvNames(env);
    expect(out).toEqual(['ANTHROPIC_API_KEY', 'DB_PASSWORD', 'GITHUB_TOKEN']);
    expect(out.join()).not.toMatch(/secret|ghp_|pw/);
  });

  it('ignores plain config vars', () => {
    expect(tokenEnvNames({ PATH: '/x', LANG: 'en' })).toEqual([]);
  });
});

describe('parseTmuxList', () => {
  it('trims and drops blank lines', () => {
    expect(parseTmuxList('0\nwork\n\n  side  \n')).toEqual(['0', 'work', 'side']);
  });
  it('empty when tmux not running', () => {
    expect(parseTmuxList('')).toEqual([]);
  });
});

describe('parseWhich', () => {
  it('marks present only the binaries which printed a path', () => {
    const stdout = '/usr/bin/git\n/usr/bin/node\n';
    expect(parseWhich(stdout, ['git', 'node', 'docker'])).toEqual([
      { name: 'git', present: true },
      { name: 'node', present: true },
      { name: 'docker', present: false },
    ]);
  });
});
