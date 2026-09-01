import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'node:path';

const FIXTURE = join(__dirname, '..', 'mcp', 'fixture-server.mjs');

vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('../admin-ops', () => ({
  managedEnvSync: () => ({}),
  mcpServerDefsSync: () => ({ 'deck-fixture': { command: process.execPath, args: [FIXTURE] } }),
  claudeReady: () => true,
}));
vi.mock('../db', () => ({ recordUsage: vi.fn() }));

const { translate } = await import('./translate');
const { threads, type: _t } = await import('./threads') as any;
const { broadcast } = await import('./broadcast');
const { clearAppCache } = await import('../mcp/apps');

const KEY = 'k';

function register() {
  const t: any = {
    handle: { kill: () => {} }, params: { mcps: ['deck-fixture'] }, prompt: '', startedAt: 0, text: '', thinking: '',
    tools: [], toolStart: new Map(), taskNotifies: new Map(), tasks: new Map(),
    taskCreates: new Map(), appTried: new Set(),
  };
  threads.set(KEY, t);
  return t;
}

function assistantWithTool(name: string, input: Record<string, unknown>) {
  return {
    type: 'assistant',
    message: { id: 'msg_1', model: 'claude-opus-4-7', content: [{ type: 'tool_use', id: 'toolu_1', name, input }] },
  } as never;
}

// O broadcast do app é assíncrono (abre sessão MCP de verdade); espera o frame chegar.
async function waitForApp(): Promise<any> {
  for (let i = 0; i < 100; i++) {
    const call = vi.mocked(broadcast).mock.calls.map((c) => c[0] as any).find((m) => m?.t === 'tool' && m.tool?.app);
    if (call) return call;
    await new Promise((r) => setTimeout(r, 50));
  }
  return undefined;
}

beforeEach(() => { threads.clear(); clearAppCache(); vi.mocked(broadcast).mockClear(); });

describe('fluxo MCP App: stream -> sessão MCP -> card', () => {
  it('anexa a UI declarada pela tool ao card já emitido', async () => {
    const thread = register();
    translate(KEY, thread, assistantWithTool('mcp__deck-fixture__counter', { titulo: 'oi' }));

    const frame = await waitForApp();
    expect(frame).toBeDefined();
    expect(frame.tool.id).toBe('toolu_1');
    expect(frame.tool.app.uri).toBe('ui://deck-fixture/counter.html');
    expect(frame.tool.app.html).toContain('MCP App rodando dentro do Deck');
    expect(frame.tool.appInput).toEqual({ titulo: 'oi' });
    // Card único: o app funde no mesmo id em vez de empilhar uma segunda entrada.
    expect(thread.tools.filter((t: any) => t.id === 'toolu_1')).toHaveLength(1);
  }, 30_000);

  it('não consulta MCP para tool nativa', async () => {
    const thread = register();
    translate(KEY, thread, assistantWithTool('Bash', { command: 'ls' }));
    await new Promise((r) => setTimeout(r, 300));
    const frames = vi.mocked(broadcast).mock.calls.map((c) => c[0] as any).filter((m) => m?.t === 'tool');
    expect(frames.every((f) => !f.tool.app)).toBe(true);
  });

  it('preserva o app quando o tool_result fecha o card', async () => {
    const thread = register();
    translate(KEY, thread, assistantWithTool('mcp__deck-fixture__counter', {}));
    await waitForApp();
    translate(KEY, thread, {
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: 'pronto' }] }] },
    } as never);
    const snap = thread.tools.find((t: any) => t.id === 'toolu_1');
    expect(snap.status).toBe('done');
    expect(snap.app?.uri).toBe('ui://deck-fixture/counter.html');
  }, 30_000);

  it('ignora server que a sessão não selecionou — trava de prompt injection', async () => {
    const thread = register();
    thread.params.mcps = ['outro-server'];
    translate(KEY, thread, assistantWithTool('mcp__deck-fixture__counter', {}));
    await new Promise((r) => setTimeout(r, 500));
    const frames = vi.mocked(broadcast).mock.calls.map((c) => c[0] as any).filter((m) => m?.t === 'tool');
    expect(frames.every((f) => !f.tool.app)).toBe(true);
    expect(thread.appTried.size).toBe(0);
  });

  it('ignora quando a sessão não selecionou nenhum MCP', async () => {
    const thread = register();
    thread.params.mcps = undefined;
    translate(KEY, thread, assistantWithTool('mcp__deck-fixture__counter', {}));
    await new Promise((r) => setTimeout(r, 500));
    const frames = vi.mocked(broadcast).mock.calls.map((c) => c[0] as any).filter((m) => m?.t === 'tool');
    expect(frames.every((f) => !f.tool.app)).toBe(true);
  });

  it('busca a UI uma vez só por tool_use id', async () => {
    const thread = register();
    const ev = assistantWithTool('mcp__deck-fixture__counter', {});
    translate(KEY, thread, ev);
    translate(KEY, thread, ev);
    await waitForApp();
    expect(thread.appTried.size).toBe(1);
  }, 30_000);
});
