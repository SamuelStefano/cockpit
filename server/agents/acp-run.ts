import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { RunHandle, RunOpts } from '../engine/claude';
import { minimalEnv } from '../engine/claude';
import type { ClaudeEvent } from '../engine/events';
import { CONFIG } from '../config';
import { sessionPath } from '../sessions/records';
import { agentIdOf, agentModelId } from '../../shared/agents';
import { ACP_CLIENT_CAPABILITIES, ACP_PROTOCOL_VERSION, AcpError, isAuthError, startAcp } from './acp-client';
import { closeDangling, mapUpdate, permissionOutcome, resultSubtype, type MapCtx } from './acp-events';
import { findAgent, saveSessionLink, sessionLinkSync } from './store';
import { TranscriptWriter } from './transcript';

// Every agent failure is already told to the user through onError in plain
// words; this end reason lets the client skip its generic "Turno encerrado".
export const ERROR_SHOWN = 'error_shown';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Agent installers drop binaries outside the PATH the supervisors inherited
// (grok → ~/.grok/bin, npm -g → ~/.local/bin or the node prefix).
// Least privilege: a third-party agent gets none of the admin-managed tokens the
// claude engine receives (minimalEnv) — only what it needs to find its binary
// and its own login under HOME.
export function agentEnv(): NodeJS.ProcessEnv {
  const base = minimalEnv();
  const extra = [join(homedir(), '.grok', 'bin'), join(homedir(), '.local', 'bin')];
  return { LANG: base.LANG, TERM: base.TERM, HOME: base.HOME, PATH: [...extra, base.PATH ?? ''].filter(Boolean).join(':'), ...COMPAT_OFF };
}

// Grok (and agents built the same way) import the MCP servers and hooks of the
// Claude/Cursor/Codex installs under HOME: an agent turn would get the owner's
// Infisical and every other MCP Claude has, and run Claude's hooks. The Deck
// passes MCPs explicitly (none today), so the imports are switched off.
export const COMPAT_OFF: Record<string, string> = Object.fromEntries(
  ['CLAUDE', 'CURSOR', 'CODEX'].flatMap((v) => ['MCPS', 'HOOKS'].map((k) => [`GROK_${v}_${k}_ENABLED`, '0'])),
);

export function loginHint(agentId: string, name: string, then = 'depois mande de novo'): string {
  const cmd = agentId === 'grok' ? 'grok login --device-auth' : agentId === 'codex' ? 'codex login --device-auth' : agentId === 'opencode' ? 'opencode auth login' : agentId === 'gemini' ? 'gemini' : null;
  return cmd
    ? `${name} não está logado nesta VPS. Abra um Terminal do Deck, rode \`${cmd}\` e confirme no navegador; ${then}.`
    : `${name} pediu login. Entre pelo próprio CLI num Terminal do Deck; ${then}.`;
}

export function runAgent(opts: RunOpts): RunHandle {
  const { prompt, resumeId, forkId, mode, model, role, appendSystemPrompt, onEvent, onError, onClose } = opts;
  const agentId = model ? agentIdOf(model) : null;
  const agent = agentId ? findAgent(agentId) : undefined;
  const deckId = (forkId && UUID_RE.test(forkId)) ? forkId : (resumeId && UUID_RE.test(resumeId)) ? resumeId : randomUUID();
  const modelId = agentModelId(agentId ?? 'desconhecido');
  const started = Date.now();
  let closedOnce = false;
  const close = () => { if (!closedOnce) { closedOnce = true; onClose(); } };
  const finish = (subtype: string, isError: boolean) => {
    onEvent({ type: 'result', subtype, is_error: isError, session_id: deckId, duration_ms: Date.now() - started, num_turns: 1, total_cost_usd: 0 } as ClaudeEvent);
  };

  // The agent auto-approves its tools outside plan mode and has no per-role
  // allowlist like the claude engine, so only the box owner may drive it.
  if (role !== 'admin') {
    onError('agentes externos só rodam para admin');
    finish(ERROR_SHOWN, true);
    close();
    return { kill: () => {}, send: () => false };
  }
  if (!agent) {
    onError(`agente "${agentId ?? model}" não está conectado — Admin → Agentes`);
    finish(ERROR_SHOWN, true);
    close();
    return { kill: () => {}, send: () => false };
  }

  const path = sessionPath(deckId);
  const transcript = path ? new TranscriptWriter(path, deckId, modelId, CONFIG.workdir) : null;
  const ctx: MapCtx = { sessionId: deckId, tools: new Map() };
  let acpSessionId: string | null = null;
  let replaying = false;
  let cancelled = false;
  let ended = false;
  const emit = (ev: ClaudeEvent) => { transcript?.observe(ev); onEvent(ev); };

  const acp = startAcp({
    command: agent.command,
    args: agent.args,
    cwd: CONFIG.workdir,
    env: agentEnv(),
    onNotification: (method, params) => {
      if (method !== 'session/update' || replaying) return;
      if (acpSessionId && params?.sessionId && params.sessionId !== acpSessionId) return;
      for (const ev of mapUpdate(params?.update, ctx)) emit(ev);
    },
    onRequest: async (method, params) => {
      if (method === 'session/request_permission') return { outcome: permissionOutcome(params?.options, mode) };
      throw new Error(`método não suportado pelo Deck: ${method}`);
    },
    onExit: (code, signal, stderrTail) => {
      if (!ended && !cancelled) {
        ended = true;
        for (const ev of closeDangling(ctx, true)) emit(ev);
        transcript?.flush();
        const why = stderrTail.trim().split('\n').slice(-3).join(' ').slice(0, 400);
        onError(`${agent.name} saiu antes de responder (${signal ?? code})${why ? `: ${why}` : ''}`, { code, signal });
        finish(ERROR_SHOWN, true);
      }
      close();
    },
  });

  acp.child.on('error', (e: NodeJS.ErrnoException) => {
    if (ended) return;
    ended = true;
    onError(e.code === 'ENOENT'
      ? `${agent.name} não está instalado nesta VPS (comando \`${agent.command}\` não encontrado) — veja Admin → Agentes`
      : `não consegui iniciar ${agent.name}: ${e.message}`);
    finish(ERROR_SHOWN, true);
    close();
  });

  (async () => {
    const init = await acp.call<any>('initialize', { protocolVersion: ACP_PROTOCOL_VERSION, clientCapabilities: ACP_CLIENT_CAPABILITIES, clientInfo: { name: 'deck', version: '1' } });
    onEvent({ type: 'system', subtype: 'init', session_id: deckId, model: modelId } as ClaudeEvent);
    const link = resumeId && !forkId ? sessionLinkSync(resumeId) : undefined;
    if (link && link.agentId === agent.id && init?.agentCapabilities?.loadSession) {
      replaying = true;
      try {
        await acp.call('session/load', { sessionId: link.acpSessionId, cwd: CONFIG.workdir, mcpServers: [] });
        acpSessionId = link.acpSessionId;
      } catch (e) {
        if (isAuthError(e)) throw e;
      } finally { replaying = false; }
    }
    // ACP has no system prompt: a Equipe bot's identity rides on the first prompt of
    // a fresh agent session, kept out of the Deck transcript the user sees.
    let wire = prompt;
    if (!acpSessionId) {
      if (appendSystemPrompt?.trim()) wire = `${appendSystemPrompt}\n\n---\n\n${prompt}`;
      const r = await acp.call<any>('session/new', { cwd: CONFIG.workdir, mcpServers: [] });
      if (typeof r?.sessionId !== 'string' || !r.sessionId) throw new Error('o agente não devolveu sessionId');
      acpSessionId = r.sessionId;
      await saveSessionLink(deckId, { agentId: agent.id, acpSessionId: r.sessionId }).catch(() => {});
    }
    transcript?.user(prompt);
    const res = await acp.call<any>('session/prompt', { sessionId: acpSessionId, prompt: [{ type: 'text', text: wire }] });
    if (ended) return;
    ended = true;
    const { subtype, isError } = resultSubtype(res?.stopReason);
    for (const ev of closeDangling(ctx, isError)) emit(ev);
    transcript?.flush();
    if (subtype === 'refusal') onError(`${agent.name} recusou o pedido`);
    finish(subtype, isError);
    acp.kill();
  })().catch((e) => {
    if (ended) return;
    ended = true;
    for (const ev of closeDangling(ctx, true)) emit(ev);
    transcript?.flush();
    onError(isAuthError(e) ? loginHint(agent.id, agent.name) : setupHint(agent.id, errorText(e)) ?? `${agent.name}: ${errorText(e)}`);
    finish(ERROR_SHOWN, true);
    acp.kill();
  });

  return {
    pid: acp.child.pid,
    kill: () => {
      if (ended) { acp.kill(); return; }
      cancelled = true;
      ended = true;
      if (acpSessionId) acp.notify('session/cancel', { sessionId: acpSessionId });
      for (const ev of closeDangling(ctx, false)) emit(ev);
      transcript?.flush();
      setTimeout(() => acp.kill(), 500).unref();
    },
    send: () => false,
  };
}

// "Internal error" alone tells nobody what broke; ACP puts the reason in data.
export function errorText(e: unknown): string {
  if (e instanceof AcpError && e.rpc.data !== undefined) {
    const d = typeof e.rpc.data === 'string' ? e.rpc.data : JSON.stringify(e.rpc.data);
    return `${e.rpc.message} — ${d.slice(0, 400)}`;
  }
  return (e as Error)?.message ?? String(e);
}

// Some refusals are account settings, not bugs, and the fix is one command the
// owner runs once. Grok Build refuses accounts still in the "Legacy (no
// storage)" privacy mode with a 403 inside a generic "Internal error".
export function setupHint(agentId: string, text: string, then = 'Depois mande a mensagem de novo.'): string | null {
  if (agentId === 'grok' && /privacy mode|privacy-mode/i.test(text)) {
    return `Sua conta do Grok está no modo de privacidade "Legacy", que o Grok Build não aceita. Num Terminal do Deck rode \`grok\`, digite \`/privacy\` e escolha Opt in ou Opt out (Opt out = a xAI não treina com o seu código). ${then}`;
  }
  return null;
}
