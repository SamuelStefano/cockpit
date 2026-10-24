import { tmpdir } from 'node:os';
import type { AgentConfig, AgentStatus, AgentView } from '../../shared/agents';
import { ACP_CLIENT_CAPABILITIES, ACP_PROTOCOL_VERSION, isAuthError, startAcp } from './acp-client';
import { agentEnv, loginHint } from './acp-run';
import { listAgentsSync } from './store';

export interface ProbeResult { status: AgentStatus; message: string; version?: string }

const PROBE_TIMEOUT_MS = 45_000;
const last = new Map<string, ProbeResult & { at: number }>();

// The real check is the one a turn needs: handshake AND open a session. Most
// agents answer initialize without a login and only refuse at session/new.
export function probeAgent(agent: AgentConfig): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let done = false;
    const settle = (r: ProbeResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      last.set(agent.id, { ...r, at: Date.now() });
      acp.kill();
      resolve(r);
    };
    const acp = startAcp({
      command: agent.command,
      args: agent.args,
      cwd: tmpdir(),
      env: agentEnv(),
      onNotification: () => {},
      onRequest: async () => ({ outcome: { outcome: 'cancelled' } }),
      onExit: (code, signal, tail) => settle({ status: 'error', message: `saiu no handshake (${signal ?? code}) ${tail.trim().split('\n').pop() ?? ''}`.trim() }),
    });
    const timer = setTimeout(() => settle({ status: 'error', message: 'sem resposta em 45s — o comando fala ACP?' }), PROBE_TIMEOUT_MS);
    acp.child.on('error', (e: NodeJS.ErrnoException) => settle(e.code === 'ENOENT'
      ? { status: 'not-installed', message: `comando \`${agent.command}\` não encontrado — faça o passo 1` }
      : { status: 'error', message: e.message }));
    (async () => {
      const init = await acp.call<any>('initialize', { protocolVersion: ACP_PROTOCOL_VERSION, clientCapabilities: ACP_CLIENT_CAPABILITIES, clientInfo: { name: 'deck', version: '1' } });
      const version = init?.agentInfo?.version ?? init?._meta?.agentVersion;
      try {
        const s = await acp.call<any>('session/new', { cwd: tmpdir(), mcpServers: [] });
        if (s?.sessionId && init?.agentCapabilities?.sessionCapabilities?.close) await acp.call('session/close', { sessionId: s.sessionId }).catch(() => {});
        settle({ status: 'ready', message: 'conectado e logado — já aparece no seletor de modelo', version: typeof version === 'string' ? version : undefined });
      } catch (e) {
        settle(isAuthError(e)
          ? { status: 'needs-login', message: loginHint(agent.id, agent.name, 'depois clique em Testar'), version: typeof version === 'string' ? version : undefined }
          : { status: 'error', message: (e as Error).message });
      }
    })().catch((e) => settle({ status: 'error', message: `handshake ACP falhou: ${(e as Error).message}` }));
  });
}

export function agentViews(): AgentView[] {
  return listAgentsSync().map((a) => {
    const r = last.get(a.id);
    return { ...a, status: r?.status ?? 'unknown', detail: r?.message, version: r?.version, checkedAt: r?.at };
  });
}
