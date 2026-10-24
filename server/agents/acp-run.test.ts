import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const managed = vi.hoisted(() => ({} as Record<string, string>));
const root = mkdtempSync(join(tmpdir(), 'deck-acp-'));
const fakeAgent = join(root, 'fake-agent.mjs');

vi.mock('node:os', async (orig) => {
  const os = await orig<typeof import('node:os')>();
  return { ...os, homedir: () => root };
});
vi.mock('../config', () => ({ CONFIG: { workdir: root, projectsDir: join(root, 'projects') } }));
vi.mock('../admin-ops', async (orig) => ({ ...(await orig<typeof import('../admin-ops')>()), managedEnvSync: () => managed }));

// A tiny ACP agent: answers the handshake, streams a chunk, runs one tool that
// asks permission, and ends the turn. LOGIN=0 makes session/new demand auth.
const AGENT_SRC = `
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';
const out = (m) => process.stdout.write(JSON.stringify(m) + '\\n');
const rl = createInterface({ input: process.stdin });
let promptId = null;
rl.on('line', (l) => {
  const m = JSON.parse(l);
  if (m.method === 'initialize') return out({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: 1, agentCapabilities: { loadSession: true }, agentInfo: { version: '9.9' } } });
  if (m.method === 'session/new') {
    if (process.argv.includes('--no-login')) return out({ jsonrpc: '2.0', id: m.id, error: { code: -32000, message: 'Authentication required' } });
    return out({ jsonrpc: '2.0', id: m.id, result: { sessionId: 'acp-1' } });
  }
  if (m.method === 'session/load') {
    out({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: m.params.sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'REPLAY' } } } });
    return out({ jsonrpc: '2.0', id: m.id, result: {} });
  }
  if (m.method === 'session/prompt') {
    promptId = m.id;
    appendFileSync(process.argv[1] + '.prompts', JSON.stringify(m.params.prompt[0].text) + '\\n');
    const sid = m.params.sessionId;
    out({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'olá ' + sid } } } });
    out({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: sid, update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'ls', kind: 'execute', status: 'pending', rawInput: { command: 'ls' } } } });
    return out({ jsonrpc: '2.0', id: 900, method: 'session/request_permission', params: { sessionId: sid, options: [{ optionId: 'ok', kind: 'allow_once' }, { optionId: 'no', kind: 'reject_once' }] } });
  }
  if (m.id === 900) {
    const sid = 'acp-1';
    out({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: sid, update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', content: [{ type: 'content', content: { type: 'text', text: 'perm=' + m.result.outcome.optionId } }] } } });
    return out({ jsonrpc: '2.0', id: promptId, result: { stopReason: 'end_turn' } });
  }
});
`;

let runAgent: typeof import('./acp-run').runAgent;
let store: typeof import('./store');

beforeAll(async () => {
  writeFileSync(fakeAgent, AGENT_SRC);
  store = await import('./store');
  ({ runAgent } = await import('./acp-run'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

async function addFake() {
  await store.addCustomAgent({ id: 'fake', name: 'Fake', command: process.execPath, args: [fakeAgent] });
}

function turn(opts: Partial<Parameters<typeof runAgent>[0]> = {}) {
  return new Promise<{ events: any[]; errors: string[] }>((resolve) => {
    const events: any[] = [];
    const errors: string[] = [];
    runAgent({ prompt: 'oi', model: 'agent:fake', role: 'admin', onEvent: (e) => events.push(e), onError: (m) => errors.push(m), onClose: () => resolve({ events, errors }), ...opts });
  });
}

describe('runAgent', () => {
  it('refuses non-admin roles', async () => {
    const { errors } = await turn({ role: 'student' });
    expect(errors[0]).toMatch(/só rodam para admin/);
  });

  it('does not hand admin-managed tokens to the agent', async () => {
    managed.GH_TOKEN = 'secret';
    try {
      const { agentEnv } = await import('./acp-run');
      expect(agentEnv().GH_TOKEN).toBeUndefined();
      expect(agentEnv().PATH).toContain('.grok/bin');
    } finally { delete managed.GH_TOKEN; }
  });

  it('rejects an agent that is not connected', async () => {
    const { events, errors } = await turn({ model: 'agent:nope' });
    expect(errors[0]).toMatch(/não está conectado/);
    expect(events.at(-1)).toMatchObject({ type: 'result', is_error: true });
  });

  it('runs a turn: init, text, tool card with permission, result, transcript', async () => {
    // execPath is an absolute path, which the command validator accepts.
    await addFake();
    const { events, errors } = await turn();
    expect(errors).toEqual([]);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('system');
    const sid = events[0].session_id;
    expect(sid).toMatch(/^[0-9a-f-]{36}$/);
    expect(events[0].model).toBe('agent:fake');
    expect(events.find((e) => e.type === 'stream_event').event.delta.text).toBe('olá acp-1');
    expect(events.find((e) => e.type === 'assistant').message.content[0]).toMatchObject({ type: 'tool_use', id: 't1', name: 'Bash' });
    expect(events.find((e) => e.type === 'user').message.content[0]).toMatchObject({ tool_use_id: 't1', content: 'perm=ok' });
    expect(events.at(-1)).toMatchObject({ type: 'result', subtype: 'success', is_error: false, session_id: sid });

    expect(store.sessionLinkSync(sid)).toEqual({ agentId: 'fake', acpSessionId: 'acp-1' });
    const file = join(root, 'projects', `${sid}.jsonl`);
    const recs = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(recs.map((r) => r.type)).toEqual(['user', 'assistant', 'assistant', 'user']);
    expect(recs[0].message.content).toBe('oi');
    expect(recs[1].message.content).toEqual([{ type: 'text', text: 'olá acp-1' }]);
    expect(recs[2].message.content[0]).toMatchObject({ type: 'tool_use', id: 't1' });
    expect(recs[1].parentUuid).toBe(recs[0].uuid);
    const { parseSession } = await import('../sessions/parse');
    const hist = await parseSession(sid) as any;
    const msgs = hist.messages ?? hist;
    expect(JSON.stringify(msgs)).toContain('olá acp-1');
    expect(JSON.stringify(msgs)).toContain('perm=ok');

    // Resume loads the same ACP session and does not leak its replay into the turn.
    const again = await turn({ resumeId: sid });
    expect(again.events[0].session_id).toBe(sid);
    expect(again.events.some((e) => e.event?.delta?.text === 'REPLAY')).toBe(false);
    expect(readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(8);
  });

  it("puts a bot's identity on the first prompt of a fresh session only, never in the transcript", async () => {
    const log = fakeAgent + '.prompts';
    rmSync(log, { force: true });
    const first = await turn({ appendSystemPrompt: 'Você é capo' });
    const sid = first.events[0].session_id;
    await turn({ resumeId: sid, appendSystemPrompt: 'Você é capo' });
    const sent = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(sent[0]).toBe('Você é capo\n\n---\n\noi');
    expect(sent[1]).toBe('oi');
    expect(readFileSync(join(root, 'projects', `${sid}.jsonl`), 'utf8')).not.toContain('Você é capo');
  });

  it('rejects tools in plan mode', async () => {
    const { events } = await turn({ mode: 'plan' });
    expect(events.find((e) => e.type === 'user').message.content[0].content).toBe('perm=no');
  });

  it('turns an auth refusal into a login hint', async () => {
    await store.addCustomAgent({ id: 'nologin', name: 'NoLogin', command: process.execPath, args: [fakeAgent, '--no-login'] });
    {
      const { events, errors } = await turn({ model: 'agent:nologin' });
      expect(errors[0]).toMatch(/pediu login|não está logado/);
      expect(events.at(-1)).toMatchObject({ type: 'result', is_error: true });
    }
  });

  it('reports a missing binary as not installed', async () => {
    await store.addCustomAgent({ id: 'ghost', name: 'Ghost', command: 'deck-no-such-agent', args: [] });
    const { errors } = await turn({ model: 'agent:ghost' });
    expect(errors[0]).toMatch(/não está instalado/);
    expect(existsSync(join(root, '.deck-agent', 'agents.json'))).toBe(true);
  });
});
