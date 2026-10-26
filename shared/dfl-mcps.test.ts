import { describe, it, expect } from 'vitest';
import { addArgv, FALLBACK_HOSTS, loginCommand, mergeStates, parseManifest, parseMcpList, validHost } from './dfl-mcps';

const LIST_SAMPLE = `Checking MCP server health…

claude.ai Claude Docs: https://api.anthropic.com/v1/pages/mcp - ✔ Connected
plugin:supabase:supabase: https://mcp.supabase.com/mcp (HTTP) - ! Needs authentication
infisical: npx -y @infisical/mcp - ✔ Connected
dfl-work: https://work.mcp.devfellowship.com/mcp (HTTP) - ! Needs authentication
dfl-mcp-plans: https://plans.mcp.devfellowship.com/mcp (HTTP) - ✔ Connected
dfl-templates: https://templates.mcp.devfellowship.com/mcp (HTTP) - ✘ Failed to connect — MCP endpoint not found
supabase: bash -c SUPABASE_ACCESS_TOKEN=$(/home/samuel/bin/supa-pat) exec npx -y @supabase/mcp-server-supabase@latest - ✔ Connected
`;

describe('parseManifest', () => {
  const ok = { hosts: [
    { host: 'campaigns', endpoint: 'https://campaigns.mcp.devfellowship.com/mcp', published: true },
    { host: 'hidden', endpoint: 'https://hidden.mcp.devfellowship.com/mcp', published: false },
  ] };

  it('keeps only published hosts', () => {
    expect(parseManifest(ok)).toEqual([{ host: 'campaigns', endpoint: 'https://campaigns.mcp.devfellowship.com/mcp' }]);
  });

  it('rejects the docs site and foreign endpoints', () => {
    const bad = { hosts: [
      { host: 'docs', endpoint: 'https://mcp.devfellowship.com', published: true },
      { host: 'evil', endpoint: 'https://evil.example.com/mcp', published: true },
      { host: 'work', endpoint: 'https://plans.mcp.devfellowship.com/mcp', published: true },
    ] };
    expect(parseManifest(bad)).toBeNull();
  });

  it('returns null for garbage so the caller falls back', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({})).toBeNull();
    expect(parseManifest({ hosts: 'x' })).toBeNull();
    expect(parseManifest({ hosts: [] })).toBeNull();
  });

  it('fallback list is itself valid', () => {
    expect(FALLBACK_HOSTS.length).toBeGreaterThan(0);
    for (const h of FALLBACK_HOSTS) expect(parseManifest({ hosts: [{ ...h, published: true }] })).not.toBeNull();
  });
});

describe('validHost', () => {
  it('accepts plain labels', () => {
    expect(validHost('campaigns')).toBe(true);
    expect(validHost('my-host')).toBe(true);
  });

  it('rejects injection and option-like names', () => {
    for (const h of ['', '-x', '--scope', 'a b', 'a;rm -rf ~', 'a$(id)', 'a`id`', 'a|b', 'A', 'a/b', 'a\nb', '../x', 'a.b']) {
      expect(validHost(h)).toBe(false);
    }
    expect(validHost(undefined)).toBe(false);
    expect(validHost(['campaigns'])).toBe(false);
  });
});

describe('parseMcpList', () => {
  const list = parseMcpList(LIST_SAMPLE);

  it('parses every server line, ignoring the header', () => {
    expect(list.map((l) => l.name)).toEqual([
      'claude.ai Claude Docs', 'plugin:supabase:supabase', 'infisical', 'dfl-work', 'dfl-mcp-plans', 'dfl-templates', 'supabase',
    ]);
  });

  it('maps statuses and strips the transport suffix', () => {
    expect(list.find((l) => l.name === 'dfl-work')).toMatchObject({ target: 'https://work.mcp.devfellowship.com/mcp', status: 'needs-auth' });
    expect(list.find((l) => l.name === 'dfl-mcp-plans')?.status).toBe('connected');
    expect(list.find((l) => l.name === 'dfl-templates')?.status).toBe('failed');
  });

  it('survives ANSI colour codes', () => {
    expect(parseMcpList('\x1b[32mdfl-x: https://x.mcp.devfellowship.com/mcp (HTTP) - ✔ Connected\x1b[0m')).toHaveLength(1);
  });
});

describe('mergeStates', () => {
  const eps = [
    { host: 'work', endpoint: 'https://work.mcp.devfellowship.com/mcp' },
    { host: 'plans', endpoint: 'https://plans.mcp.devfellowship.com/mcp' },
    { host: 'quiz', endpoint: 'https://quiz.mcp.devfellowship.com/mcp' },
  ];
  const merged = mergeStates(eps, parseMcpList(LIST_SAMPLE));

  it('matches by endpoint, keeping the configured name', () => {
    expect(merged[1]).toMatchObject({ host: 'plans', name: 'dfl-mcp-plans', status: 'connected' });
    expect(merged[0]).toMatchObject({ name: 'dfl-work', status: 'needs-auth' });
  });

  it('marks unconfigured hosts missing with the default name', () => {
    expect(merged[2]).toMatchObject({ name: 'dfl-quiz', status: 'missing' });
  });
});

describe('addArgv', () => {
  it('builds a fixed argv with the user scope', () => {
    expect(addArgv({ host: 'campaigns', endpoint: 'https://campaigns.mcp.devfellowship.com/mcp' })).toEqual([
      'mcp', 'add', '--transport', 'http', '--scope', 'user', 'dfl-campaigns', 'https://campaigns.mcp.devfellowship.com/mcp',
    ]);
  });
});

describe('loginCommand', () => {
  it('types the login for a safe name', () => {
    expect(loginCommand('dfl-work')).toBe('claude mcp login dfl-work');
  });

  it('refuses a name that could end up as shell syntax', () => {
    expect(loginCommand('dfl-work; rm -rf ~')).toBeNull();
    expect(loginCommand('$(id)')).toBeNull();
    expect(loginCommand('-h')).toBeNull();
  });
});
