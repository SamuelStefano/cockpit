import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const token = vi.hoisted(() => ({ value: 'tok' as string | null }));
vi.mock('../oauth', () => ({ readOAuthToken: async () => token.value }));

import {
  connectorDefs,
  refreshClaudeAiConnectors,
  claudeAiConnectorDefsSync,
  resetClaudeAiConnectorsForTest,
} from './claudeai-connectors';

const okFetch = (data: unknown) =>
  vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200 })) as unknown as typeof fetch;

beforeEach(() => {
  token.value = 'tok';
  delete process.env.ENABLE_CLAUDEAI_MCP_SERVERS;
  resetClaudeAiConnectorsForTest();
});
afterEach(() => { delete process.env.ENABLE_CLAUDEAI_MCP_SERVERS; });

describe('connectorDefs', () => {
  it('maps entries to claudeai-proxy defs', () => {
    expect(connectorDefs([{ id: 'a1', url: 'https://x/mcp', display_name: 'dfl' }])).toEqual({
      'claude.ai dfl': { type: 'claudeai-proxy', url: 'https://x/mcp', id: 'a1' },
    });
  });

  it('suffixes duplicate names', () => {
    const e = (id: string) => ({ id, url: 'https://x', display_name: 'dfl' });
    expect(Object.keys(connectorDefs([e('1'), e('2'), e('3')]))).toEqual([
      'claude.ai dfl', 'claude.ai dfl (2)', 'claude.ai dfl (3)',
    ]);
  });

  it('ignores malformed entries', () => {
    expect(connectorDefs([null, 1, {}, { id: 1, url: 'u', display_name: 'n' }, { id: 'a', url: 'u' }, { id: '', url: 'u', display_name: 'n' }])).toEqual({});
    expect(connectorDefs('nope')).toEqual({});
  });
});

describe('refreshClaudeAiConnectors', () => {
  const one = [{ id: 'a', url: 'https://x', display_name: 'dfl' }];

  it('updates the cache and reports change only once', async () => {
    const f = okFetch(one);
    expect(await refreshClaudeAiConnectors(f, true)).toBe(true);
    expect(Object.keys(claudeAiConnectorDefsSync())).toEqual(['claude.ai dfl']);
    expect(await refreshClaudeAiConnectors(f, true)).toBe(false);
  });

  it('sends the auth and beta headers', async () => {
    const f = okFetch(one);
    await refreshClaudeAiConnectors(f, true);
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'anthropic-beta': 'mcp-servers-2025-12-04' });
  });

  it('throttles non-forced refreshes after a success', async () => {
    const f = okFetch(one);
    await refreshClaudeAiConnectors(f, true);
    expect(await refreshClaudeAiConnectors(f)).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('reuses the in-flight promise', async () => {
    const f = okFetch(one);
    await Promise.all([refreshClaudeAiConnectors(f, true), refreshClaudeAiConnectors(f, true)]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous cache on failure', async () => {
    await refreshClaudeAiConnectors(okFetch(one), true);
    const bad = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    expect(await refreshClaudeAiConnectors(bad, true)).toBe(false);
    const boom = vi.fn(async () => { throw new Error('net'); }) as unknown as typeof fetch;
    expect(await refreshClaudeAiConnectors(boom, true)).toBe(false);
    expect(Object.keys(claudeAiConnectorDefsSync())).toEqual(['claude.ai dfl']);
  });

  it('is empty when opted out via env', async () => {
    await refreshClaudeAiConnectors(okFetch(one), true);
    process.env.ENABLE_CLAUDEAI_MCP_SERVERS = 'off';
    expect(claudeAiConnectorDefsSync()).toEqual({});
    const f = okFetch(one);
    await refreshClaudeAiConnectors(f, true);
    expect(f).not.toHaveBeenCalled();
    expect(claudeAiConnectorDefsSync()).toEqual({});
  });

  it('does not fetch without a token', async () => {
    token.value = null;
    const f = okFetch(one);
    expect(await refreshClaudeAiConnectors(f, true)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
