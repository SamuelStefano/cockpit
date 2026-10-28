import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDflMcps, dflMcpsState, loadHosts, resetManifestCache } from './dfl-mcps';

const manifest = { hosts: [
  { host: 'work', endpoint: 'https://work.mcp.devfellowship.com/mcp', published: true },
  { host: 'quiz', endpoint: 'https://quiz.mcp.devfellowship.com/mcp', published: true },
] };
const okFetch = (async () => ({ ok: true, json: async () => manifest })) as unknown as typeof fetch;
const LIST = 'dfl-work: https://work.mcp.devfellowship.com/mcp (HTTP) - ! Needs authentication\n';

beforeEach(() => resetManifestCache());

describe('loadHosts', () => {
  it('reads the manifest and caches it', async () => {
    const f = vi.fn(okFetch);
    expect((await loadHosts(f as never)).source).toBe('manifest');
    await loadHosts(f as never);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('falls back to the built-in list when the fetch fails', async () => {
    const r = await loadHosts((async () => { throw new Error('offline'); }) as never);
    expect(r.source).toBe('fallback');
    expect(r.hosts.length).toBeGreaterThan(0);
  });

  it('falls back on a non-200 or an empty manifest', async () => {
    expect((await loadHosts((async () => ({ ok: false, status: 500 })) as never)).source).toBe('fallback');
    expect((await loadHosts((async () => ({ ok: true, json: async () => ({ hosts: [] }) })) as never)).source).toBe('fallback');
  });
});

describe('dflMcpsState', () => {
  it('merges the listing with the manifest', async () => {
    const s = await dflMcpsState({ exec: async () => LIST, fetchFn: okFetch });
    expect(s.hosts.map((h) => [h.host, h.status])).toEqual([['work', 'needs-auth'], ['quiz', 'missing']]);
  });

  it('reports an error instead of throwing when claude is unavailable', async () => {
    const s = await dflMcpsState({ exec: async () => { throw new Error('ENOENT'); }, fetchFn: okFetch });
    expect(s.error).toContain('ENOENT');
  });
});

describe('addDflMcps', () => {
  it('adds only missing hosts, with the exact argv', async () => {
    const exec = vi.fn(async (args: string[]) => (args[1] === 'list' ? LIST : ''));
    const s = await addDflMcps([], { exec, fetchFn: okFetch });
    const adds = exec.mock.calls.filter((c) => c[0][1] === 'add').map((c) => c[0]);
    expect(adds).toEqual([['mcp', 'add', '--transport', 'http', '--scope', 'user', 'dfl-quiz', 'https://quiz.mcp.devfellowship.com/mcp']]);
    expect(s.op).toEqual({ ok: true, message: '1 MCP(s) adicionado(s)' });
  });

  it('says the login is still missing when the added host needs auth', async () => {
    let added = false;
    const exec = vi.fn(async (args: string[]) => {
      if (args[1] === 'add') { added = true; return ''; }
      return added ? `${LIST}dfl-quiz: https://quiz.mcp.devfellowship.com/mcp (HTTP) - ! Needs authentication\n` : LIST;
    });
    const s = await addDflMcps(['quiz'], { exec, fetchFn: okFetch });
    expect(s.op).toEqual({ ok: true, message: '1 MCP(s) adicionado(s); falta entrar: clique em Entrar' });
  });

  it('ignores hosts that are injected or not in the manifest', async () => {
    const exec = vi.fn(async (args: string[]) => (args[1] === 'list' ? '' : ''));
    await addDflMcps(['x; rm -rf ~', '--scope', 'evil', 'docs'], { exec, fetchFn: okFetch });
    expect(exec.mock.calls.some((c) => c[0][1] === 'add')).toBe(false);
  });

  it('reports a failed add', async () => {
    const exec = async (args: string[]) => { if (args[1] === 'add') throw new Error('boom'); return ''; };
    const s = await addDflMcps(['quiz'], { exec, fetchFn: okFetch });
    expect(s.op?.ok).toBe(false);
  });
});
