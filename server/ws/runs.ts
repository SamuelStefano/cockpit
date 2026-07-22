import type { WebSocket } from 'ws';
import type { ToolCall, ToolTodo, Cron } from '../../shared/protocol';
import { run, type RunHandle } from '../engine/claude';
import { CONFIG } from '../config';
import type { Role } from '../auth';
import { broadcast, send } from './broadcast';
import { translate } from './translate';
import { summarize } from '../summary';
import { classify, quickAnswer, killSideRuns, killSideRunsFor } from '../engine/triage';
import { suggestFollowups } from '../engine/suggest';
import { awaitingAnswer } from './awaiting';
import { parkedHeads, shiftParked, computePaused, underWindowCap, noteWindowDrain } from './parked';
import { getLastPlanUsage } from './usage-plan';
import { getLastRate } from './rate';

export interface Thread {
  handle: RunHandle;
  prompt: string;       // instrução em execução — contexto p/ o triador do próximo prompt
  startedAt: number;    // ts do início do turno; replayado no reconnect pra o cronômetro não reiniciar do zero após F5
  lastFrameAt?: number; // ts do último frame NDJSON traduzido; o reaper mata quem fica mudo além do teto
  sessionId?: string;
  costUsd?: number;     // custo real do turno (result.total_cost_usd, ground-truth)
  durationMs?: number;
  numTurns?: number;
  turnTokens?: number;  // total faturável do turno: soma de TODAS as chamadas API (input+output+cache_creation, SEM cache read), p/ stat discreta na bolha
  inputTokens?: number;
  outputTokens?: number;
  lastBilledMsgId?: string; // dedupe do acúmulo: a mesma chamada API emite vários eventos assistant com o mesmo message.id
  endReason?: string;   // result.subtype: success | error_max_budget | error_max_turns | ...
  model?: string;       // modelo EFETIVO do turno (message.model do CLI); pode divergir do pedido sob --fallback-model
  stopped?: boolean;    // turno foi morto por stop do usuário — o 'done' do onClose não deve notificar "turno concluído"
  questioned?: boolean; // turno fez AskUserQuestion: o `claude -p` auto-resolve e CONTINUA gerando — suprime tudo que vier depois pra a pergunta ficar como última (respondível)
  // Snapshot acumulado p/ replay no reconnect (#10). Os frames vão por broadcast.
  text: string;
  thinking: string;
  tools: ToolCall[];
  toolStart: Map<string, number>; // id -> início, p/ cravar duração no close; morre com o thread
  taskNotifies: Map<string, number>; // task-id -> nº de notificações no turno, p/ detectar loop de subagente zumbi
  // Registry da lista de tarefas do turno (TaskCreate/TaskUpdate): a lista é estado
  // acumulado entre tools — cada mutação carimba um snapshot no card (ws/tools.ts).
  tasks: Map<string, ToolTodo>;
  taskCreates: Map<string, { subject: string; activeForm?: string }>; // tool_use id -> create aguardando o nº da task no result
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
  mcps?: string[];
  effort?: string;
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

// Stop cancela SÓ o turno atual — a fila é preservada e o próximo item sobe no
// onClose (pedido do Samuel: cancelar um prompt não pode apagar a fila inteira).
// O bump de época ainda descarta uma mensagem que estava EM TRIAGEM no instante do
// stop (senão ela viraria um turno novo logo após o stop, furando o cancelamento).
export function onStop(sessionKey: string): void {
  stopEpoch.set(sessionKey, (stopEpoch.get(sessionKey) ?? 0) + 1);
  // Side-runs (triagem/quick-answer haiku) NÃO viviam em `threads` — o stop só
  // matava o turno principal e esses one-shots seguiam vivos, a quick-answer ainda
  // fazia broadcast depois do stop. Mata os daquela sessão agora.
  killSideRunsFor(sessionKey);
  // Marca o thread vivo: seu onClose vai emitir 'done' (limpa o phase em todos os
  // clientes), mas com stopped=true pra o cliente NÃO disparar notificação de
  // "turno concluído" — o usuário interrompeu de propósito. Flag morre com o thread.
  const t = threads.get(sessionKey);
  if (t) t.stopped = true;
}

// O servidor keyeia o thread pela chave com que o run COMEÇOU ("new-xxx" numa
// sessão nova) e nunca re-keyea; o cliente migra o display pro sessionId real. Um
// stop que chega com a chave migrada dava miss no `threads.get()` → kill no-op (o
// bug "o botão não para"). O front já manda a chave certa (serverKey), mas isto é a
// rede de segurança do lado do servidor: cai pro sessionId se a chave direta falhar.
export function resolveThreadKey(sessionKey: string): string | undefined {
  if (threads.has(sessionKey)) return sessionKey;
  for (const [k, t] of threads) if (t.sessionId === sessionKey) return k;
  return undefined;
}

// Ponto único de stop: resolve a chave real do thread ANTES de marcar/matar, pra
// onStop (bump de época + limpa side-runs) e o kill acertarem o mesmo turno.
export function stopSession(sessionKey: string): void {
  const key = resolveThreadKey(sessionKey) ?? sessionKey;
  onStop(key);
  threads.get(key)?.handle.kill();
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

// Tetos do reaper: um turno mudo além de SILENCE_CAP (nenhum frame chegando —
// "garimpando" eterno) ou vivo além de TOTAL_CAP (independente de frames) é
// considerado travado e morto. SILENCE alto o bastante pra não matar um Bash/build
// legítimo que fica quieto esperando o tool_result; TOTAL como rede final absoluta.
export const REAPER_SILENCE_CAP_MS = 15 * 60_000;
export const REAPER_TOTAL_CAP_MS = 45 * 60_000;

// Pura (testável): decide quais chaves reapar. lastFrameAt ausente → usa startedAt
// (turno que nunca emitiu frame conta silêncio desde o início).
export function findStaleThreads(
  now: number,
  entries: Iterable<[string, { startedAt: number; lastFrameAt?: number }]>,
  silenceCap = REAPER_SILENCE_CAP_MS,
  totalCap = REAPER_TOTAL_CAP_MS,
): string[] {
  const stale: string[] = [];
  for (const [key, t] of entries) {
    const silentFor = now - (t.lastFrameAt ?? t.startedAt);
    const aliveFor = now - t.startedAt;
    if (silentFor >= silenceCap || aliveFor >= totalCap) stale.push(key);
  }
  return stale;
}

function reapStaleRuns(): void {
  const stale = findStaleThreads(Date.now(), threads);
  for (const key of stale) {
    // Mesmo caminho de um stop do usuário: marca stopped (sem notificação de
    // "concluído"), mata a árvore e deixa o onClose emitir 'done' → a UI cai pra
    // idle e a fila daquela sessão finalmente drena (o prompt que "não enviava").
    broadcast({ t: 'error', sessionKey: key, message: 'turno travado encerrado automaticamente' });
    stopSession(key);
  }
}

let reaperTimer: ReturnType<typeof setInterval> | null = null;
// Varre a cada minuto. unref: o timer não segura o event loop no shutdown.
export function startRunReaper(intervalMs = 60_000): void {
  if (reaperTimer) return;
  reaperTimer = setInterval(reapStaleRuns, intervalMs);
  reaperTimer.unref?.();
}

// --- drainer da fila ESTACIONADA (overnight/quota-out) ----------------------

// Só o processo do AGENTE liga o drainer (startParkedDrainer). Sem esta trava, o
// index (loopback) e o agente (relay) rodariam o mesmo dreno lendo o parked.json
// compartilhado → dois shifts do mesmo item = envio dobrado. O gatilho no onClose
// também respeita esta flag.
let drainerEnabled = false;

// Dispara os itens elegíveis: sessão OCIOSA (sem turno rodando) E quota disponível
// (não pausado) E abaixo do teto por janela. Drena um item por sessão por passada;
// o item que sobe deixa a sessão ocupada, então o resto da fila dela sai no próximo
// tick (ou no gatilho do onClose). Roda no processo do agente — a fonte de quota
// (getLastPlanUsage/getLastRate) está fresca lá (o loop de plan-usage roda no agente).
function drainParked(): void {
  if (!drainerEnabled) return;
  const usage = getLastPlanUsage();
  const rate = getLastRate();
  // Quota esgotada (janela cheia ou rate-limit duro do CLI) → nada dispara; espera
  // a janela resetar. computePaused espelha o gate visual do cliente (App.tsx).
  if (computePaused(usage, rate, Date.now())) return;
  for (const { sessionKey } of parkedHeads()) {
    if (!underWindowCap(usage)) break; // teto da janela batido: para de drenar
    if (resolveThreadKey(sessionKey)) continue; // turno rodando: um por vez
    const item = shiftParked(sessionKey);
    if (!item) continue;
    noteWindowDrain(usage);
    // ws null: run sem cliente específico (igual cron); o stream vai por broadcast.
    // resumeId = a sessão onde o item foi enfileirado, pra continuar a conversa.
    startRun(null, sessionKey, item.prompt, item.resumeId, undefined, item.mode, item.model, item.maxBudgetUsd, item.bypass, item.role, item.disallowedSkills, item.mcps, item.effort);
  }
}

let parkedTimer: ReturnType<typeof setInterval> | null = null;
// Liga o drainer (só no agente). Varre a cada 30s: quota volta / sessão fica ociosa
// sem depender do browser aberto. unref: não segura o event loop no shutdown.
export function startParkedDrainer(intervalMs = 30_000): void {
  drainerEnabled = true;
  if (parkedTimer) return;
  parkedTimer = setInterval(drainParked, intervalMs);
  parkedTimer.unref?.();
}

const SESSION_KEY_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// ws null = run sem cliente específico (cron agendado): erros vão por broadcast e
// o stream do turno é broadcastado a todos os clientes como qualquer outro run.
export function startRun(ws: WebSocket | null, sessionKey: string, prompt: string, resumeId?: string, msgId?: string, mode?: string, model?: string, maxBudgetUsd?: number, bypass?: boolean, role?: Role, disallowedSkills?: string[], mcps?: string[], effort?: string, auto?: boolean) {
  // sessionKey é string crua do cliente usada como chave do mapa `threads` e
  // ecoada nos broadcasts; restringe a um slug (cobre uuid e as keys 'new-…').
  if (typeof sessionKey !== 'string' || !SESSION_KEY_RE.test(sessionKey)) {
    if (ws) send(ws, { t: 'error', message: 'sessão inválida' });
    return;
  }
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) {
    if (ws) send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' });
    return;
  }
  // Latch pós-pergunta: o flush automático da fila do cliente decide com estado
  // possivelmente vazio (history ainda não carregado) e chegava 1-2s depois do
  // AskUserQuestion — o run novo substituía o turno perguntante e o card de escolha
  // sumia. Estaciona o auto na fila do servidor; a RESPOSTA do usuário (send manual)
  // limpa o latch e o onClose dela drena o estacionado na sequência.
  if (auto && awaitingAnswer.has(sessionKey)) {
    if (ws) {
      if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });
      if (!enqueue(sessionKey, { ws, prompt, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort }))
        send(ws, { t: 'error', sessionKey, message: 'fila de mensagens cheia' });
    }
    return;
  }
  if (!auto) awaitingAnswer.delete(sessionKey);
  const replacing = threads.has(sessionKey);
  if (!admitRun(threads.size, replacing)) {
    if (ws) send(ws, { t: 'error', sessionKey, message: 'limite de sessões simultâneas atingido' });
    return;
  }
  if (replacing) threads.get(sessionKey)!.handle.kill();

  const thread: Thread = { handle: { kill: () => {} }, prompt, startedAt: Date.now(), sessionId: resumeId, text: '', thinking: '', tools: [], toolStart: new Map(), taskNotifies: new Map(), tasks: new Map(), taskCreates: new Map() };
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
    effort,
    maxBudgetUsd,
    bypass,
    role,
    disallowedSkills,
    mcps,
    onEvent: (ev) => translate(sessionKey, thread, ev),
    onError: (message) => broadcast({ t: 'error', sessionKey, message }),
    onClose: () => {
      // Se este thread já foi substituído por um run mais novo na mesma key
      // (re-send que matou o anterior), o onClose do antigo NÃO deve mandar um
      // 'done' prematuro nem apagar a entrada do novo run.
      if (threads.get(sessionKey) !== thread) return;
      broadcast({ t: 'done', sessionKey, sessionId: thread.sessionId ?? '', costUsd: thread.costUsd, durationMs: thread.durationMs, numTurns: thread.numTurns, turnTokens: thread.turnTokens, inputTokens: thread.inputTokens, outputTokens: thread.outputTokens, endReason: thread.endReason, model: thread.model, stopped: thread.stopped });
      // Resumo IA do que a sessão fez, atualizado ao fim do turno (pedido do Samuel).
      // Fire-and-forget: best-effort, nunca bloqueia/derruba o fechamento do run.
      // Pula em stop do usuário (turno interrompido não vale uma chamada API paga) —
      // o throttle interno de summarize() cobre o resto da redução de gasto.
      // Pula resumo em stop e em sessões de CRON (cron-<id>): turno autônomo agendado
      // não vale uma chamada API de resumo a cada disparo.
      if (thread.sessionId && !thread.stopped && !sessionKey.startsWith('cron-')) void summarize(thread.sessionId);
      // Chips de continuação (estilo ChatGPT): só em turno de usuário concluído de
      // verdade (não stop, não cron, não AskUserQuestion pendente) e sem fila — um
      // prompt enfileirado vai rodar já; sugerir tópicos agora seria ruído. Se um
      // turno novo começar antes do haiku voltar, o resultado é descartado.
      if (!thread.stopped && !thread.questioned && !sessionKey.startsWith('cron-') && !pending.get(sessionKey)?.length) {
        void suggestFollowups(thread.prompt, thread.text, sessionKey).then((items) => {
          if (items.length && !threads.has(sessionKey)) broadcast({ t: 'suggestions', sessionKey, items });
        }).catch(() => {});
      }
      threads.delete(sessionKey);
      stopEpoch.delete(sessionKey); // época só vive enquanto há turno/triagem; senão vaza monotônico
      // Após AskUserQuestion o turno aguarda a RESPOSTA do usuário (próximo prompt) —
      // não drenar a fila aqui, senão um enfileirado fura na frente da resposta.
      if (!thread.questioned) {
        drainPending(sessionKey, thread.sessionId);
        // Gatilho da fila estacionada: se a in-turn (pending) não pegou a sessão,
        // dispara o próximo item overnight já, sem esperar o tick de 30s. Self-guard:
        // se drainPending subiu um turno, resolveThreadKey pega e drainParked pula.
        drainParked();
      }
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
  const first = arr.shift()!;
  // Coalesce: junta itens CONSECUTIVOS de mesma classe (merge/wait) e mesmos
  // params de turno num único --resume — vários prompts enfileirados viravam N
  // turnos sequenciais, cada um re-lendo o contexto e re-pensando (latência
  // empilhada). Divergência de params impede merge seguro → para o batch.
  const same = (a: QueuedSend, b: QueuedSend) =>
    a.merge === b.merge && a.mode === b.mode && a.model === b.model &&
    a.maxBudgetUsd === b.maxBudgetUsd && a.bypass === b.bypass && a.role === b.role &&
    JSON.stringify(a.mcps) === JSON.stringify(b.mcps) &&
    JSON.stringify(a.disallowedSkills) === JSON.stringify(b.disallowedSkills);
  const batch = [first];
  while (arr.length && same(first, arr[0])) batch.push(arr.shift()!);
  if (arr.length === 0) pending.delete(sessionKey);
  const joined = batch.map((b) => b.prompt).join('\n\n');
  const text = first.merge ? `Complemento do pedido anterior:\n\n${joined}` : joined;
  // msgId undefined: a bolha do usuário já foi ecoada no routeSend (não duplica).
  startRun(first.ws, sessionKey, text, resumeId, undefined, first.mode, first.model, first.maxBudgetUsd, first.bypass, first.role, first.disallowedSkills, first.mcps, first.effort);
}

// Roteia um prompt enviado com o turno da sessão OCUPADO. Ecoa a bolha do usuário
// na hora, pede o veredito ao triador (haiku) e age conforme a decisão (auto).
export async function routeSend(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, msgId?: string, mode?: string, model?: string, maxBudgetUsd?: number, bypass?: boolean, role?: Role, disallowedSkills?: string[], mcps?: string[], effort?: string) {
  if (typeof sessionKey !== 'string' || !SESSION_KEY_RE.test(sessionKey)) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) { send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' }); return; }
  const cur = threads.get(sessionKey);
  if (!cur) { startRun(ws, sessionKey, prompt, resumeId, msgId, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort); return; } // corrida: turno fechou

  // Bolha do usuário aparece já (antes da decisão da triagem, que leva ~alguns s).
  if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });

  const epoch = stopEpoch.get(sessionKey) ?? 0;
  const verdict = await classify(cur.prompt, cur.text, prompt, sessionKey);

  // Stop durante o await da triagem → o usuário pediu silêncio; descarta.
  if ((stopEpoch.get(sessionKey) ?? 0) !== epoch) return;

  // O turno avaliado pode ter fechado/sido substituído durante o await (~s) do
  // triador. Agir sobre o veredito agora atingiria o turno ERRADO: 'priority'
  // mataria um run que nunca avaliamos (flap/queima de token), 'merge'/'wait'
  // enfileiraria contra outra linhagem. Re-checa identidade antes de agir.
  if (threads.get(sessionKey) !== cur) {
    if (!threads.has(sessionKey)) startRun(ws, sessionKey, prompt, resumeId, undefined, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort);
    else if (!enqueue(sessionKey, { ws, prompt, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort, merge: false })) {
      broadcast({ t: 'error', sessionKey, message: 'fila de mensagens cheia' });
    }
    return;
  }

  broadcast({ t: 'triage', sessionKey, msgId, action: verdict.action, reason: verdict.reason });

  switch (verdict.action) {
    case 'priority': {
      // Interrompe o turno atual e roda já. startRun mata o anterior (replacing).
      // Carrega o progresso parcial do turno morto no prompt: o trabalho já pensado
      // não estava no JSONL (turno interrompido), então sem isso o modelo re-derivava
      // do zero (a "repetição de pensamento" reportada). msgId undefined: bolha já ecoada.
      const carry = cur.text || cur.thinking
        ? `Você estava no meio de: ${cur.prompt}\n\nProgresso até agora (não repita, continue daqui):\n${(cur.thinking || '').slice(-1500)}\n${(cur.text || '').slice(-1500)}\n\nNOVA INSTRUÇÃO URGENTE (priorize):\n${prompt}`
        : prompt;
      startRun(ws, sessionKey, carry, resumeId, undefined, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort);
      return;
    }
    case 'answer':
      // Fallback: haiku falhou/timeout (retorna '') → NÃO engolir a mensagem em
      // silêncio; degrada pra 'wait' (responde quando o turno fechar).
      void runQuickAnswer(sessionKey, prompt, epoch, () => {
        if (!threads.has(sessionKey)) { startRun(ws, sessionKey, prompt, resumeId, undefined, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort); return; }
        if (!enqueue(sessionKey, { ws, prompt, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort, merge: false })) {
          broadcast({ t: 'error', sessionKey, message: 'fila de mensagens cheia' });
        }
      });
      return;
    case 'merge':
    case 'wait':
      if (!enqueue(sessionKey, { ws, prompt, msgId, mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort, merge: verdict.action === 'merge' })) {
        broadcast({ t: 'error', sessionKey, message: 'fila de mensagens cheia' });
      }
      return;
  }
}

// Subagente responde direto, em bolha à parte, sem tocar o turno principal.
// epoch capturado no routeSend: se um stop aconteceu durante o oneShot (até 60s),
// a época muda e a resposta é descartada — senão a quick-answer pingava depois do
// stop. O killSideRunsFor no onStop já mata o processo; o guard cobre a corrida.
async function runQuickAnswer(sessionKey: string, prompt: string, epoch: number, onEmpty?: () => void) {
  const text = await quickAnswer(prompt, sessionKey);
  if ((stopEpoch.get(sessionKey) ?? 0) !== epoch) return;
  if (!text) { onEmpty?.(); return; }
  broadcast({ t: 'quick-answer', sessionKey, id: `qa-${Date.now().toString(36)}`, text, ts: Date.now() });
}

// Dispara um cron como turno autônomo (sem cliente). sessionKey estável por cron
// (`cron-<id>`): runs repetidos do mesmo cron continuam visíveis como uma sessão.
// Se a sessão do cron já estiver rodando (turno anterior não fechou), startRun
// substitui (replacing) — não acumula. Novo turno (sem resume): cada disparo é
// independente. O stream vai por broadcast pra qualquer cliente conectado.
export function fireCron(cron: Cron): void {
  if (!cron || typeof cron.prompt !== 'string' || !cron.prompt.trim()) return;
  startRun(null, `cron-${cron.id}`, cron.prompt, undefined, `cron-${Date.now().toString(36)}`, cron.mode, cron.model, undefined, undefined, undefined, undefined, undefined, cron.effort || 'low');
}
