import type { WebSocket } from 'ws';
import type { ToolCall } from '../../shared/protocol';
import { run, type RunHandle } from '../engine/claude';
import { CONFIG } from '../config';
import { currentRole } from '../auth';
import { broadcast, send } from './broadcast';
import { translate } from './translate';

export interface Thread {
  handle: RunHandle;
  sessionId?: string;
  costUsd?: number;     // custo real do turno (result.total_cost_usd, ground-truth)
  durationMs?: number;
  numTurns?: number;
  endReason?: string;   // result.subtype: success | error_max_budget | error_max_turns | ...
  model?: string;       // modelo EFETIVO do turno (message.model do CLI); pode divergir do pedido sob --fallback-model
  // Snapshot acumulado p/ replay no reconnect (#10). Os frames vão por broadcast.
  text: string;
  thinking: string;
  tools: ToolCall[];
  toolStart: Map<string, number>; // id -> início, p/ cravar duração no close; morre com o thread
}

export const threads = new Map<string, Thread>();

export function admitRun(liveRuns: number, replacing: boolean, cap = CONFIG.maxConcurrentRuns): boolean {
  return replacing || liveRuns < cap;
}

const startedAt = Date.now();
let lastStatsAt = 0;
export function markStatsAt(now: number) { lastStatsAt = now; }

// Saúde do processo pro /healthz: se o HTTP responde isto, o event loop não está
// totalmente travado. activeRuns/lastStatsAt são informativos (supervisor decide).
export function runStats(): { uptimeMs: number; activeRuns: number; lastStatsAt: number } {
  return { uptimeMs: Date.now() - startedAt, activeRuns: threads.size, lastStatsAt };
}

// Mata toda a árvore de runs vivos. Chamado no shutdown do processo: sem isto,
// um restart (tsx watch, OOM-reap, Ctrl-C) deixa cada `claude -p` detached
// rodando órfão a noite toda — queimando token/CPU sem socket lendo o stdout,
// e o run some pro cliente (threads é só memória). kill() já escala SIGTERM→
// SIGKILL no grupo (detached), então isto encerra a árvore inteira.
export function killAllRuns(): void {
  for (const t of threads.values()) {
    try { t.handle.kill(); } catch { /* já morto */ }
  }
}

export function startRun(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, mode?: string, model?: string, effort?: string, maxBudgetUsd?: number, bypass?: boolean) {
  if (Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) {
    send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' });
    return;
  }
  const replacing = threads.has(sessionKey);
  if (!admitRun(threads.size, replacing)) {
    send(ws, { t: 'error', sessionKey, message: 'limite de sessões simultâneas atingido' });
    return;
  }
  if (replacing) threads.get(sessionKey)!.handle.kill();

  const thread: Thread = { handle: { kill: () => {} }, sessionId: resumeId, text: '', thinking: '', tools: [], toolStart: new Map() };
  threads.set(sessionKey, thread);
  broadcast({ t: 'started', sessionKey });

  thread.handle = run({
    prompt,
    resumeId,
    mode,
    model,
    effort,
    maxBudgetUsd,
    bypass,
    role: currentRole(),
    onEvent: (ev) => translate(sessionKey, thread, ev),
    onError: (message) => broadcast({ t: 'error', sessionKey, message }),
    onClose: () => {
      // Se este thread já foi substituído por um run mais novo na mesma key
      // (re-send que matou o anterior), o onClose do antigo NÃO deve mandar um
      // 'done' prematuro nem apagar a entrada do novo run.
      if (threads.get(sessionKey) !== thread) return;
      broadcast({ t: 'done', sessionKey, sessionId: thread.sessionId ?? '', costUsd: thread.costUsd, durationMs: thread.durationMs, numTurns: thread.numTurns, endReason: thread.endReason, model: thread.model });
      threads.delete(sessionKey);
    },
  });
}
