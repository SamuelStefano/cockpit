import type { WebSocket } from 'ws';
import type { ToolCall } from '../../shared/protocol';
import { run, type RunHandle } from '../engine/claude';
import { CONFIG } from '../config';
import type { Role } from '../auth';
import { broadcast, send } from './broadcast';
import { translate } from './translate';
import { summarize } from '../summary';
import { classify, quickAnswer, killSideRuns } from '../engine/triage';

export interface Thread {
  handle: RunHandle;
  prompt: string;       // instrução em execução — contexto p/ o triador do próximo prompt
  startedAt: number;    // ts do início do turno; replayado no reconnect pra o cronômetro não reiniciar do zero após F5
  sessionId?: string;
  costUsd?: number;     // custo real do turno (result.total_cost_usd, ground-truth)
  durationMs?: number;
  numTurns?: number;
  turnTokens?: number;  // total faturável do turno (input+output+cache do result.usage), p/ stat discreta na bolha
  endReason?: string;   // result.subtype: success | error_max_budget | error_max_turns | ...
  model?: string;       // modelo EFETIVO do turno (message.model do CLI); pode divergir do pedido sob --fallback-model
  stopped?: boolean;    // turno foi morto por stop do usuário — o 'done' do onClose não deve notificar "turno concluído"
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
  role?: Role;
  disallowedSkills?: string[];
  merge?: boolean;
}
const pending = new Map<string, QueuedSend[]>();

// Teto da fila por sessão: sem isto, marteladas num turno ocupado enfileiram sem
// limite — cada item segura um prompt (até maxPromptBytes) e um ws, a memória
// cresce a noite toda. Acima do teto, recusa com erro em vez de acumular.
const MAX_PENDING = 50;
function enqueue(sessionKey: string, item: QueuedSend): boolean {
  const arr = pending.get(sessionKey) ?? [];
  if (arr.length >= MAX_PENDING) return false;
  arr.push(item);
  pending.set(sessionKey, arr);
  return true;
}

// Época de stop por sessão: incrementa a cada stop explícito. routeSend captura a
// época ANTES do await da triagem; se ela mudou quando o veredito chega, um stop
// aconteceu no meio e a mensagem é descartada (senão o run avaliado some e o
// fallback "turno fechou → roda como novo" sobe a mensagem logo após o stop).
const stopEpoch = new Map<string, number>();

// Stop explícito do usuário deve significar silêncio. Sem isto: (a) o onClose do
// turno morto chama drainPending e a mensagem enfileirada (wait/merge) sobe logo;
// (b) uma mensagem em triagem no momento do stop vira novo turno ao resolver. A
// limpeza da fila cobre (a); o bump de época cobre (b).
export function onStop(sessionKey: string): void {
  pending.delete(sessionKey);
  stopEpoch.set(sessionKey, (stopEpoch.get(sessionKey) ?? 0) + 1);
  // Marca o thread vivo: seu onClose vai emitir 'done' (limpa o phase em todos os
  // clientes), mas com stopped=true pra o cliente NÃO disparar notificação de
  // "turno concluído" — o usuário interrompeu de propósito. Flag morre com o thread.
  const t = threads.get(sessionKey);
  if (t) t.stopped = true;
}

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

export function startRun(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, msgId?: string, mode?: string, model?: string, maxBudgetUsd?: number, bypass?: boolean, role?: Role, disallowedSkills?: string[]) {
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

  const thread: Thread = { handle: { kill: () => {} }, prompt, startedAt: Date.now(), sessionId: resumeId, text: '', thinking: '', tools: [], toolStart: new Map() };
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
    role,
    disallowedSkills,
    onEvent: (ev) => translate(sessionKey, thread, ev),
    onError: (message) => broadcast({ t: 'error', sessionKey, message }),
    onClose: () => {
      // Se este thread já foi substituído por um run mais novo na mesma key
      // (re-send que matou o anterior), o onClose do antigo NÃO deve mandar um
      // 'done' prematuro nem apagar a entrada do novo run.
      if (threads.get(sessionKey) !== thread) return;
      broadcast({ t: 'done', sessionKey, sessionId: thread.sessionId ?? '', costUsd: thread.costUsd, durationMs: thread.durationMs, numTurns: thread.numTurns, turnTokens: thread.turnTokens, endReason: thread.endReason, model: thread.model, stopped: thread.stopped });
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
  startRun(next.ws, sessionKey, text, resumeId, undefined, next.mode, next.model, next.maxBudgetUsd, next.bypass, next.role, next.disallowedSkills);
}

// Roteia um prompt enviado com o turno da sessão OCUPADO. Ecoa a bolha do usuário
// na hora, pede o veredito ao triador (haiku) e age conforme a decisão (auto).
export async function routeSend(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, msgId?: string, mode?: string, model?: string, maxBudgetUsd?: number, bypass?: boolean, role?: Role, disallowedSkills?: string[]) {
  if (typeof sessionKey !== 'string' || !SESSION_KEY_RE.test(sessionKey)) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) { send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' }); return; }
  const cur = threads.get(sessionKey);
  if (!cur) { startRun(ws, sessionKey, prompt, resumeId, msgId, mode, model, maxBudgetUsd, bypass, role, disallowedSkills); return; } // corrida: turno fechou

  // Bolha do usuário aparece já (antes da decisão da triagem, que leva ~alguns s).
  if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });

  const epoch = stopEpoch.get(sessionKey) ?? 0;
  const verdict = await classify(cur.prompt, cur.text, prompt);

  // Stop durante o await da triagem → o usuário pediu silêncio; descarta.
  if ((stopEpoch.get(sessionKey) ?? 0) !== epoch) return;

  // O turno avaliado pode ter fechado/sido substituído durante o await (~s) do
  // triador. Agir sobre o veredito agora atingiria o turno ERRADO: 'priority'
  // mataria um run que nunca avaliamos (flap/queima de token), 'merge'/'wait'
  // enfileiraria contra outra linhagem. Re-checa identidade antes de agir.
  if (threads.get(sessionKey) !== cur) {
    if (!threads.has(sessionKey)) startRun(ws, sessionKey, prompt, resumeId, undefined, mode, model, maxBudgetUsd, bypass, role, disallowedSkills);
    else if (!enqueue(sessionKey, { ws, prompt, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, merge: false })) {
      broadcast({ t: 'error', sessionKey, message: 'fila de mensagens cheia' });
    }
    return;
  }

  broadcast({ t: 'triage', sessionKey, msgId, action: verdict.action, reason: verdict.reason });

  switch (verdict.action) {
    case 'priority':
      // Interrompe o turno atual e roda já. startRun mata o anterior (replacing).
      // msgId undefined: a bolha já foi ecoada acima.
      startRun(ws, sessionKey, prompt, resumeId, undefined, mode, model, maxBudgetUsd, bypass, role, disallowedSkills);
      return;
    case 'answer':
      void runQuickAnswer(sessionKey, prompt);
      return;
    case 'merge':
    case 'wait':
      if (!enqueue(sessionKey, { ws, prompt, msgId, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, merge: verdict.action === 'merge' })) {
        broadcast({ t: 'error', sessionKey, message: 'fila de mensagens cheia' });
      }
      return;
  }
}

// Subagente responde direto, em bolha à parte, sem tocar o turno principal.
async function runQuickAnswer(sessionKey: string, prompt: string) {
  const text = await quickAnswer(prompt);
  if (!text) return;
  broadcast({ t: 'quick-answer', sessionKey, id: `qa-${Date.now().toString(36)}`, text, ts: Date.now() });
}
