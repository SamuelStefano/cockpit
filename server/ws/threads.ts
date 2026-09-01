import type { ToolCall, ToolTodo } from '../../shared/protocol';
import type { RunHandle } from '../engine/claude';
import { CONFIG } from '../config';
import type { Role } from '../auth';
import { killSideRuns, killSideRunsFor } from '../engine/triage';
import type { ParkedItem } from './parked';
import type { StaleReason } from './reaper';

// Config do turno, guardada no thread pra a retomada automática (morte silenciosa)
// rodar com os MESMOS parâmetros — retomar em outro modelo/sem bypass mudaria o
// comportamento no meio do trabalho.
export interface RunParams {
  mode?: string;
  model?: string;
  maxBudgetUsd?: number;
  bypass?: boolean;
  role?: Role;
  disallowedSkills?: string[];
  mcps?: string[];
  effort?: string;
}

// Lista única das chaves de RunParams. O `satisfies Record<keyof RunParams, 0>`
// é o ponto: acrescentar um campo ao RunParams sem listá-lo aqui vira ERRO DE
// COMPILAÇÃO. Antes esses campos eram copiados à mão em cada lugar que os
// manuseia, e o comparador do coalesce (sameParams) já tinha esquecido o
// `effort` — dois prompts com esforço diferente viravam um turno só, rodando com
// o esforço do primeiro, calado.
export const RUN_PARAM_KEYS = Object.keys({
  mode: 0, model: 0, maxBudgetUsd: 0, bypass: 0, role: 0,
  disallowedSkills: 0, mcps: 0, effort: 0,
} satisfies Record<keyof RunParams, 0>) as (keyof RunParams)[];

// Extrai só a config do turno de um objeto maior (opções do startRun, item da
// fila) — evita guardar `ws`/`prompt` no thread e no live-runs.json.
export function runParams(o: RunParams): RunParams {
  const p: Record<string, unknown> = {};
  for (const k of RUN_PARAM_KEYS) if (o[k] !== undefined) p[k] = o[k];
  return p as RunParams;
}

// Dois turnos podem ser fundidos num só --resume? Só com config idêntica.
export function sameParams(a: RunParams, b: RunParams): boolean {
  return RUN_PARAM_KEYS.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
}

export interface Thread {
  handle: RunHandle;
  params: RunParams;
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
  stopped?: boolean;    // turno foi morto (stop do usuário, reaper, guarda de pressão, shutdown) — o 'done' do onClose não deve notificar "turno concluído"
  userStopped?: boolean; // o stop veio do USUÁRIO. Só ele impede o item de fila de voltar pra fila: kill nosso (OOM/deploy/reaper) não consumiu o prompt
  reaped?: StaleReason; // morto pelo reaper: usa stopped (sem notificar "concluído") MAS tem direito a retomada automática
  questioned?: boolean; // turno fez AskUserQuestion: o `claude -p` auto-resolve e CONTINUA gerando — suprime tudo que vier depois pra a pergunta ficar como última (respondível)
  parked?: ParkedItem;  // item que a fila estacionada drenou neste turno; volta pra fila se o teto de tokens matar o turno sem consumi-lo
  parkedFrom?: string;  // sessão de onde o item saiu — no disparo avulso a chave do turno é a do FORK, e devolver por ela criaria uma fila fantasma
  lastError?: string;   // último erro reportado pelo processo
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
  appTried: Set<string>; // tool_use id já consultado por UI de MCP App — a busca é feita uma vez só por card
}

export const threads = new Map<string, Thread>();

// Época de stop por sessão: incrementa a cada stop explícito. routeSend captura a
// época ANTES do await da triagem; se ela mudou quando o veredito chega, um stop
// aconteceu no meio e a mensagem é descartada (senão o run avaliado some e o
// fallback "turno fechou → roda como novo" sobe a mensagem logo após o stop).
const stopEpoch = new Map<string, number>();

export function stopEpochOf(sessionKey: string): number {
  return stopEpoch.get(sessionKey) ?? 0;
}

export function clearStopEpoch(sessionKey: string): void {
  stopEpoch.delete(sessionKey);
}

// Stop cancela SÓ o turno atual — a fila é preservada e o próximo item sobe no
// onClose (pedido do Samuel: cancelar um prompt não pode apagar a fila inteira).
// O bump de época ainda descarta uma mensagem que estava EM TRIAGEM no instante do
// stop (senão ela viraria um turno novo logo após o stop, furando o cancelamento).
export function onStop(sessionKey: string): void {
  // Side-runs (triagem/quick-answer haiku) NÃO viviam em `threads` — o stop só
  // matava o turno principal e esses one-shots seguiam vivos, a quick-answer ainda
  // fazia broadcast depois do stop. Mata os daquela sessão agora.
  killSideRunsFor(sessionKey);
  const t = threads.get(sessionKey);
  // Sem turno vivo não há triagem em voo pra invalidar, e a época só é apagada no
  // onClose de um turno: bumpar aqui deixava a entrada presa no mapa pra sempre.
  // Stop de sessão já fechada é o caso COMUM (clique repetido no botão), então numa
  // aba de dias o mapa crescia sem teto.
  if (!t) { stopEpoch.delete(sessionKey); return; }
  stopEpoch.set(sessionKey, stopEpochOf(sessionKey) + 1);
  // Marca o thread vivo: seu onClose vai emitir 'done' (limpa o phase em todos os
  // clientes), mas com stopped=true pra o cliente NÃO disparar notificação de
  // "turno concluído" — o usuário interrompeu de propósito. Flag morre com o thread.
  t.stopped = true;
  t.userStopped = true;
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
// preserveLive: no SHUTDOWN os turnos devem continuar no live-runs.json pra o boot
// retomá-los (é o caso mais comum de turno morto: deploy). Na guarda de pressão o
// processo segue vivo e o registro é limpo — retomar depois recriaria a pressão que
// motivou o kill.
let preserveLiveOnClose = false;
export function shouldPreserveLive(): boolean { return preserveLiveOnClose; }

export function killAllRuns(opts: { preserveLive?: boolean } = {}): void {
  preserveLiveOnClose = !!opts.preserveLive;
  for (const t of threads.values()) {
    // Kill NOSSO, não morte silenciosa: sem esta marca o onClose de cada turno veria
    // "fechou sem result" e dispararia uma retomada automática por sessão — em cima
    // do shutdown (processo saindo, claude detached e órfão) ou da guarda de pressão
    // (ressuscitando justamente o que foi morto pra salvar a box).
    t.stopped = true;
    try { t.handle.kill(); } catch { /* já morto */ }
  }
  killSideRuns(); // one-shots de triagem/quick-answer não vivem em `threads`
}
