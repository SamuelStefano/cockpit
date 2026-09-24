import { describe, it, expect } from 'vitest';
import { MCP_TOOLS } from './format';
import { runTool } from './tools';

// The MCP server is reachable from outside the box (Cursor over Tailscale). Its
// whole safety argument is "read-only surface": pin the exact tool list so a
// write tool (installContext, handoff, send) cannot slip in unnoticed.
const READ_ONLY = ['contexts_list', 'contexts_read', 'sessions_list', 'sessions_search', 'sessions_read', 'skills_list', 'skills_read'];

describe('MCP tools', () => {
  it('exposes exactly the read-only set', () => {
    expect(MCP_TOOLS.map((t) => t.name).sort()).toEqual([...READ_ONLY].sort());
  });

  it('refuses an unknown tool name', async () => {
    await expect(runTool('contexts_install', {})).rejects.toThrow('tool desconhecida');
  });

  it('treats traversal ids as not found', async () => {
    await expect(runTool('contexts_read', { id: '../../.ssh/id_rsa' })).rejects.toThrow('não encontrado');
    await expect(runTool('skills_read', { id: '../x' })).rejects.toThrow('não encontrada');
  });
});
