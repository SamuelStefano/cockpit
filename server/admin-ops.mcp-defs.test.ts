import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const home = vi.hoisted(() => `${process.env.TMPDIR ?? '/tmp'}/deck-adminops-mcp-${process.pid}`);
vi.mock('node:os', async (orig) => ({ ...(await orig<typeof import('node:os')>()), homedir: () => home }));

const connectors = vi.hoisted(() => ({ defs: {} as Record<string, unknown> }));
vi.mock('./mcp/claudeai-connectors', () => ({ claudeAiConnectorDefsSync: () => connectors.defs }));

const { mcpServerDefsSync } = await import('./admin-ops');

const write = (j: unknown) => writeFileSync(join(home, '.claude.json'), JSON.stringify(j));

describe('mcpServerDefsSync merge', () => {
  beforeEach(() => {
    rmSync(home, { recursive: true, force: true });
    mkdirSync(home, { recursive: true });
    connectors.defs = {};
  });

  it('merges connectors, user and project servers with project winning', () => {
    connectors.defs = { 'claude.ai dfl': { type: 'claudeai-proxy' }, shared: { from: 'connector' } };
    write({
      mcpServers: { shared: { from: 'user' }, u: { command: 'u' } },
      projects: {
        '/work': { mcpServers: { shared: { from: 'project' }, p: { command: 'p' } } },
        '/other': { mcpServers: { nope: { command: 'x' } } },
      },
    });
    const defs = mcpServerDefsSync('/work');
    expect(Object.keys(defs).sort()).toEqual(['claude.ai dfl', 'p', 'shared', 'u']);
    expect(defs.shared).toEqual({ from: 'project' });
  });

  it('still returns connectors when the file is missing', () => {
    connectors.defs = { 'claude.ai dfl': { type: 'claudeai-proxy' } };
    expect(Object.keys(mcpServerDefsSync('/work'))).toEqual(['claude.ai dfl']);
  });
});
