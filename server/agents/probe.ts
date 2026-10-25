import { tmpdir } from 'node:os';
import type { AgentConfig, AgentStatus, AgentView } from '../../shared/agents';
import { ACP_CLIENT_CAPABILITIES, ACP_PROTOCOL_VERSION, isAuthError, startAcp } from './acp-client';
import { agentEnv, errorText, loginHint, setupHint } from './acp-run';
import { listAgentsSync } from './store';

export interface ProbeResult { status: AgentStatus; message: string; version?: string }

const PROBE_TIMEOUT_MS = 90_000;
export const PROBE_PROMPT = 'Deck connection test. Reply with exactly: OK';
const last = new Map<string, ProbeResult & { at: number }>();

// The check is the one a turn needs, end to end: handshake, open a session AND
// get an answer. Grok answers initialize and session/new on an account that
// still cannot run a prompt, so stopping at the session gave a false "Pronto".
export function probeAgent(agent: AgentConfig, readyNote = 'já aparece no seletor de modelo'): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let done = false;
    let version: string | undefined;
    let reply = '';
    const settle = (r: ProbeResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const out = { ...r, version: r.version ?? version };
      last.set(agent.id, { ...out, at: Date.now() });
      acp.kill();
      resolve(out);
    };
    const acp = startAcp({
      command: agent.command,
      args: agent.args,
      cwd: tmpdir(),
      env: agentEnv(),
      onNotification: (method, params) => {
        const u = params?.update;
        if (method === 'session/update' && u?.sessionUpdate === 'agent_message_chunk' && typeof u.content?.text === 'string') reply += u.content.text;
      },
      // A test prompt never needs a tool; refuse anything it asks for.
      onRequest: async () => ({ outcome: { outcome: 'cancelled' } }),
      onExit: (code, signal, tail) => settle({ status: 'error', message: `saiu no meio do teste (${signal ?? code}) ${tail.trim().split('\n').pop() ?? ''}`.trim() }),
    });
    const timer = setTimeout(() => settle({ status: 'error', message: 'sem resposta em 90s — o comando fala ACP?' }), PROBE_TIMEOUT_MS);
    acp.child.on('error', (e: NodeJS.ErrnoException) => settle(e.code === 'ENOENT'
      ? { status: 'not-installed', message: `comando \`${agent.command}\` não encontrado — faça o passo 1` }
      : { status: 'error', message: e.message }));
    (async () => {
      const init = await acp.call<any>('initialize', { protocolVersion: ACP_PROTOCOL_VERSION, clientCapabilities: ACP_CLIENT_CAPABILITIES, clientInfo: { name: 'deck', version: '1' } });
      const v = init?.agentInfo?.version ?? init?._meta?.agentVersion;
      version = typeof v === 'string' ? v : undefined;
      try {
        const s = await acp.call<any>('session/new', { cwd: tmpdir(), mcpServers: [] });
        const r = await acp.call<any>('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text: PROBE_PROMPT }] });
        if (s?.sessionId && init?.agentCapabilities?.sessionCapabilities?.close) await acp.call('session/close', { sessionId: s.sessionId }).catch(() => {});
        const said = reply.trim().slice(0, 80);
        settle(r?.stopReason === 'refusal'
          ? { status: 'error', message: 'o agente recusou o teste' }
          : { status: 'ready', message: `respondeu${said ? ` "${said}"` : ''} — ${readyNote}` });
      } catch (e) {
        if (isAuthError(e)) { settle({ status: 'needs-login', message: loginHint(agent.id, agent.name, 'depois clique em Testar') }); return; }
        const text = errorText(e);
        const hint = setupHint(agent.id, text, 'Depois clique em Testar.');
        settle(hint ? { status: 'needs-login', message: hint } : { status: 'error', message: text });
      }
    })().catch((e) => settle({ status: 'error', message: `handshake ACP falhou: ${errorText(e)}` }));
  });
}

export function agentViews(): AgentView[] {
  return listAgentsSync().map((a) => {
    const r = last.get(a.id);
    return { ...a, status: r?.status ?? 'unknown', detail: r?.message, version: r?.version, checkedAt: r?.at };
  });
}
