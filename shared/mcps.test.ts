import { describe, it, expect } from 'vitest';
import { loginCommand, parseMcpList } from './mcps';

const LIST_SAMPLE = `Checking MCP server health…

claude.ai Claude Docs: https://api.anthropic.com/v1/pages/mcp - ✔ Connected
plugin:supabase:supabase: https://mcp.supabase.com/mcp (HTTP) - ! Needs authentication
infisical: npx -y @infisical/mcp - ✔ Connected
github: https://api.githubcopilot.com/mcp/ (HTTP) - ! Needs authentication
notes: https://notes.example.com/mcp (HTTP) - ✔ Connected
broken: https://broken.example.com/mcp (HTTP) - ✘ Failed to connect — MCP endpoint not found
supabase: bash -c SUPABASE_ACCESS_TOKEN=$(/home/samuel/bin/supa-pat) exec npx -y @supabase/mcp-server-supabase@latest - ✔ Connected
`;

describe('parseMcpList', () => {
  const list = parseMcpList(LIST_SAMPLE);

  it('parses every server line, ignoring the header', () => {
    expect(list.map((l) => l.name)).toEqual([
      'claude.ai Claude Docs', 'plugin:supabase:supabase', 'infisical', 'github', 'notes', 'broken', 'supabase',
    ]);
  });

  it('maps statuses and strips the transport suffix', () => {
    expect(list.find((l) => l.name === 'github')).toMatchObject({ target: 'https://api.githubcopilot.com/mcp/', status: 'needs-auth' });
    expect(list.find((l) => l.name === 'notes')?.status).toBe('connected');
    expect(list.find((l) => l.name === 'broken')?.status).toBe('failed');
  });

  it('survives ANSI colour codes', () => {
    expect(parseMcpList('\x1b[32mx: https://x.example.com/mcp (HTTP) - ✔ Connected\x1b[0m')).toHaveLength(1);
  });
});

describe('loginCommand', () => {
  it('types the login for a safe name', () => {
    expect(loginCommand('github')).toBe('claude mcp login github');
  });

  it('refuses a name that could end up as shell syntax', () => {
    expect(loginCommand('github; rm -rf ~')).toBeNull();
    expect(loginCommand('$(id)')).toBeNull();
    expect(loginCommand('-h')).toBeNull();
  });
});
