import { describe, it, expect, vi } from 'vitest';

const opened = vi.hoisted(() => ({ n: 0 }));
vi.mock('./client', () => ({ openSession: async () => { opened.n++; return undefined; } }));

const { resolveApp, clearAppCache } = await import('./apps');

describe('resolveApp with a server that fails to open', () => {
  it('does not reopen it on every tool call', async () => {
    clearAppCache();
    await resolveApp('mcp__broken__a');
    await resolveApp('mcp__broken__b');
    await resolveApp('mcp__broken__c');
    expect(opened.n).toBe(1);
  });
});
