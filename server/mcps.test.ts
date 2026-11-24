import { describe, it, expect } from 'vitest';
import { mcpsState } from './mcps';

const LIST = [
  'Checking MCP server health…',
  'github: https://api.githubcopilot.com/mcp/ (HTTP) - ✔ Connected',
  'notes: https://notes.example.com/mcp (HTTP) - ! Needs authentication',
  '',
].join('\n');

describe('mcpsState', () => {
  it('lists every configured server, whoever runs it', async () => {
    const s = await mcpsState({ exec: async () => LIST });
    expect(s.servers.map((m) => [m.name, m.status])).toEqual([['github', 'connected'], ['notes', 'needs-auth']]);
    expect(s.error).toBeUndefined();
  });

  it('asks the CLI for the list and nothing else', async () => {
    const calls: string[][] = [];
    await mcpsState({ exec: async (args) => { calls.push(args); return ''; } });
    expect(calls).toEqual([['mcp', 'list']]);
  });

  it('reports an error instead of throwing when claude is unavailable', async () => {
    const s = await mcpsState({ exec: async () => { throw new Error('ENOENT'); } });
    expect(s.servers).toEqual([]);
    expect(s.error).toContain('ENOENT');
  });
});
