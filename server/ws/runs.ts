import type { WebSocket } from 'ws';
import type { ToolCall } from '../../shared/protocol';
import { run, type RunHandle } from '../engine/claude';
import { CONFIG } from '../config';
import { currentRole } from '../auth';
import { broadcast, send } from './broadcast';
import { translate } from './translate';
import { summarize } from '../summary';
import { classify, quickAnswer, killSideRuns } from '../engine/triage';

export interface Thread {
  handle: RunHandle;
  prompt: string;       // instrução em execução — contexto p/ o triador do próximo prompt
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

// Fila de prompts triados como 'wait'/'merge' enquanto o turno da sessão rodava.
// Drenada (sequencialmente) no onClose do turno atual — um turno por vez, mantendo
// a invariante "1 runMsg por sessão" do cliente. merge marca p/ enquadrar como
// continuação no drain.
interface QueuedSend {
  ws: WebSocket;
  prompt: string;
  msgId?: string;
  mode?: string;
  model?: string;
  maxBudgetUsd?: number;
  bypass?: boolean;
  merge?: boolean;
}
const pending = new Map<string, QueuedSend[]>();

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
  killSideRuns(); // one-shots de triagem/quick-answer não vivem em `threads`
}

const SESSION_KEY_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function startRun(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, msgId?: string, mode?: string, model?: string, maxBudgetUsd?: number, bypass?: boolean) {
  // sessionKey é string crua do cliente usada como chave do mapa `threads` e
  // ecoada nos broadcasts; restringe a um slug (cobre uuid e as keys 'new-…').
  if (typeof sessionKey !== 'string' || !SESSION_KEY_RE.test(sessionKey)) {
    send(ws, { t: 'error', message: 'sessão inválida' });
    return;
  }
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) {
    send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' });
    return;
  }
  const replacing = threads.has(sessionKey);
  if (!admitRun(threads.size, replacing)) {
    send(ws, { t: 'error', sessionKey, message: 'limite de sessões simultâneas atingido' });
    return;
  }
  if (replacing) threads.get(sessionKey)!.handle.kill();

  const thread: Thread = { handle: { kill: () => {} }, prompt, sessionId: resumeId, text: '', thinking: '', tools: [], toolStart: new Map() };
  threads.set(sessionKey, thread);
  // Eco da mensagem do usuário a todos os clientes ANTES do 'started' (bolha do
  // usuário aparece antes da do assistente). Só quando o cliente mandou msgId — o
  // dedup no remetente depende de casar o id otimista dele.
  if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });
  broadcast({ t: 'started', sessionKey });

  thread.handle = run({
    prompt,
    resumeId,
    mode,
    model,
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
      // Resumo IA do que a sessão fez, atualizado ao fim do turno (pedido do Samuel).
      // Fire-and-forget: best-effort, nunca bloqueia/derruba o fechamento do run.
      if (thread.sessionId) void summarize(thread.sessionId);
      threads.delete(sessionKey);
      drainPending(sessionKey, thread.sessionId);
    },
  });
}

// Drena UM prompt enfileirado (triagem 'wait'/'merge') como o próximo turno da
// sessão. Sequencial: o onClose deste turno drena o seguinte. Continua a mesma
// conversa via resumeId (sessionId do turno recém-fechado). merge enquadra como
// complemento explícito.
function drainPending(sessionKey: string, resumeId?: string) {
  const arr = pending.get(sessionKey);
  if (!arr || arr.length === 0) return;
  const next = arr.shift()!;
  if (arr.length === 0) pending.delete(sessionKey);
  const text = next.merge ? `Complemento do pedido anterior:\n\n${next.prompt}` : next.prompt;
  // msgId undefined: a bolha do usuário já foi ecoada no routeSend (não duplica).
  startRun(next.ws, sessionKey, text, resumeId, undefined, next.mode, next.model, next.maxBudgetUsd, next.bypass);
}

// Roteia um prompt enviado com o turno da sessão OCUPADO. Ecoa a bolha do usuário
// na hora, pede o veredito ao triador (haiku) e age conforme a decisão (auto).
export async function routeSend(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, msgId?: string, mode?: string, model?: string, maxBudgetUsd?: number, bypass?: boolean) {
  if (typeof sessionKey !== 'string' || !SESSION_KEY_RE.test(sessionKey)) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) { send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' }); return; }
  const cur = threads.get(sessionKey);
  if (!cur) { startRun(ws, sessionKey, prompt, resumeId, msgId, mode, model, maxBudgetUsd, bypass); return; } // corrida: turno fechou

  // Bolha do usuário aparece já (antes da decisão da triagem, que leva ~alguns s).
  if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });

  const verdict = await classify(cur.prompt, cur.text, prompt);
  broadcast({ t: 'triage', sessionKey, msgId, action: verdict.action, reason: verdict.reason });

  switch (verdict.action) {
    case 'priority':
      // Interrompe o turno atual e roda já. startRun mata o anterior (replacing).
      // msgId undefined: a bolha já foi ecoada acima.
      startRun(ws, sessionKey, prompt, resumeId, undefined, mode, model, maxBudgetUsd, bypass);
      return;
    case 'answer':
      void runQuickAnswer(sessionKey, prompt);
      return;
    case 'merge':
    case 'wait': {
      const arr = pending.get(sessionKey) ?? [];
      arr.push({ ws, prompt, msgId, mode, model, maxBudgetUsd, bypass, merge: verdict.action === 'merge' });
      pending.set(sessionKey, arr);
      return;
    }
  }
}

// Subagente responde direto, em bolha à parte, sem tocar o turno principal.
async function runQuickAnswer(sessionKey: string, prompt: string) {
  const text = await quickAnswer(prompt);
  if (!text) return;
  broadcast({ t: 'quick-answer', sessionKey, id: `qa-${Date.now().toString(36)}`, text, ts: Date.now() });
}
