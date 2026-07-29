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
import { parkedHeads, shiftParked, isQueuePaused } from './parked';
import { markRunLive, clearRunLive, takeOrphanRuns } from './recover';
import { recordIncident } from './incidents';

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
  stopped?: boolean;    // turno foi morto por stop do usuário — o 'done' do onClose não deve notificar "turno concluído"
  reaped?: StaleReason; // morto pelo reaper: usa stopped (sem notificar "concluído") MAS tem direito a retomada automática
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
// preserveLive: no SHUTDOWN os turnos devem continuar no live-runs.json pra o boot
// retomá-los (é o caso mais comum de turno morto: deploy). Na guarda de pressão o
// processo segue vivo e o registro é limpo — retomar depois recriaria a pressão que
// motivou o kill.
let preserveLiveOnClose = false;
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

// Tetos do reaper. Só SILÊNCIO condena um turno, e o teto depende de haver tool em
// voo: mudo SEM tool aberta = o modelo travou ("garimpando" eterno); mudo COM tool
// aberta = build/teste/subagente longo, que fica minutos sem emitir frame e é
// trabalho legítimo. O teto por TEMPO DE VIDA era 45min e matava turno saudável em
// pleno progresso — o Deck existe pra disparar trabalho longo e fechar a aba, e sem
// browser o frame de erro não chegava a ninguém: era o "o turno só roda com a
// janela aberta". Fica só como rede final contra run desgovernado.
export const REAPER_SILENCE_CAP_MS = 15 * 60_000;
export const REAPER_TOOL_SILENCE_CAP_MS = 90 * 60_000;
export const REAPER_TOTAL_CAP_MS = 8 * 60 * 60_000;

export type StaleReason = 'silence' | 'tool' | 'total';
export interface StaleVerdict { key: string; reason: StaleReason; ms: number }

// Pura (testável): decide quais chaves reapar e por quê. lastFrameAt ausente → usa
// startedAt (turno que nunca emitiu frame conta silêncio desde o início).
// openToolsAt = quando cada tool AINDA ABERTA começou. Recebe os instantes, não a
// contagem: um tool_use sem tool_result (subagente morto, parse perdido) ficaria
// contado como "em voo" pelo resto do turno e rebaixaria o teto de silêncio de 15
// pra 90min pra sempre. Tool aberta há mais que o teto dela não conta como trabalho.
export function findStaleThreads(
  now: number,
  entries: Iterable<[string, { startedAt: number; lastFrameAt?: number; openToolsAt?: number[] }]>,
  caps: { silence?: number; toolSilence?: number; total?: number } = {},
): StaleVerdict[] {
  const silenceCap = caps.silence ?? REAPER_SILENCE_CAP_MS;
  const toolCap = caps.toolSilence ?? REAPER_TOOL_SILENCE_CAP_MS;
  const totalCap = caps.total ?? REAPER_TOTAL_CAP_MS;
  const stale: StaleVerdict[] = [];
  for (const [key, t] of entries) {
    const silentFor = now - (t.lastFrameAt ?? t.startedAt);
    const aliveFor = now - t.startedAt;
    const busy = (t.openToolsAt ?? []).some((at) => now - at < toolCap);
    if (silentFor >= (busy ? toolCap : silenceCap)) stale.push({ key, reason: busy ? 'tool' : 'silence', ms: silentFor });
    else if (aliveFor >= totalCap) stale.push({ key, reason: 'total', ms: aliveFor });
  }
  return stale;
}

// Só constata a morte. A promessa de retomada é do autoResume, que é quem sabe se
// ela vai acontecer de fato (a fila do usuário tem prioridade e pode ganhar a
// corrida) — prometer aqui virava mentira na tela.
const REAP_MESSAGE: Record<StaleReason, string> = {
  silence: 'O turno ficou mudo tempo demais e foi encerrado.',
  tool: 'Uma ferramenta travou e o turno foi encerrado.',
  total: 'O turno passou do tempo máximo de vida e foi encerrado.',
};

export function reapStaleRuns(): void {
  const now = Date.now();
  const snapshot = [...threads]
    // Já marcado = kill em andamento (nosso ou do usuário). O thread só sai de
    // `threads` no onClose, que pode demorar — ou não vir, se a tool travada segura
    // o processo. Sem esta guarda o reaper re-mataria a mesma chave a cada passada,
    // duplicando bolha de erro e incidente a cada minuto.
    .filter(([, t]) => !t.reaped && !t.stopped)
    .map(([key, t]) =>
      [key, { startedAt: t.startedAt, lastFrameAt: t.lastFrameAt, openToolsAt: [...t.toolStart.values()] }] as [string, { startedAt: number; lastFrameAt?: number; openToolsAt: number[] }]);
  for (const v of findStaleThreads(now, snapshot)) {
    const thread = threads.get(v.key);
    if (!thread) continue;
    // Marca reaped ANTES do kill: o onClose usa a marca pra retomar o turno sozinho.
    // Antes o reaper só passava por stopSession, então o turno ficava indistinguível
    // de um stop do usuário — morria sem retomada, sem registro e (sem browser) sem
    // ninguém pra ver o erro.
    thread.reaped = v.reason;
    console.error(`[reaper] ${v.key}: ${v.reason} há ${Math.round(v.ms / 1000)}s`);
    recordIncident({ kind: 'reaped', sessionKey: v.key, sessionId: thread.sessionId, detail: `${v.reason} há ${Math.round(v.ms / 1000)}s, ${thread.tools.length} tools` });
    broadcast({ t: 'error', sessionKey: v.key, message: REAP_MESSAGE[v.reason] });
    stopSession(v.key);
  }
}

// --- morte silenciosa do turno (o "chat simplesmente parou") -----------------

// Todo turno normal termina com o evento `result` do `claude`, que carimba
// endReason ('success' | 'error_max_budget' | ...). Fechar SEM result e sem stop
// do usuário = o processo morreu no meio (crash, OOM-reap, queda de API) e ninguém
// avisa: shouldReportExit engole o exit quando o code é 0/nosso kill, e a UI só
// mostra o cronômetro — idêntico a um turno concluído. Foi o que aconteceu em
// 2026-07-25T05:29Z: o turno rodou 10m35s, o último evento foi um tool_result e o
// processo sumiu sem result. Este predicado é o detector.
export function isSilentDeath(t: { stopped?: boolean; endReason?: string }): boolean {
  return !t.stopped && !t.endReason;
}

// Uma retomada automática por incidente. Mais que isso vira loop de queima de
// token quando a causa é permanente (quota estourada, API fora) — o teto garante
// que a falha crônica apareça pro usuário em vez de rodar em círculos.
export const AUTO_RESUME_CAP = 1;
const autoResumes = new Map<string, number>();

// Prompt da retomada: o JSONL sobrevive à morte do processo, então --resume
// reconstrói o contexto inteiro e o turno continua de onde parou.
const RESUME_PROMPT = 'O turno anterior foi interrompido por uma falha do processo. Continue exatamente de onde parou, sem repetir o trabalho já feito.';

// Retoma o turno morto com a MESMA config. Silencioso quanto a corridas: se a fila
// (pending/parked) ou o usuário já subiram um turno novo, não atropela.
function autoResume(sessionKey: string, thread: Thread): void {
  if (threads.has(sessionKey)) return;          // já há turno novo na sessão
  if (awaitingAnswer.has(sessionKey)) return;   // turno aguarda resposta do usuário
  if (!thread.sessionId) return;                // sem sessionId não há --resume possível
  const tries = (autoResumes.get(sessionKey) ?? 0) + 1;
  if (tries > AUTO_RESUME_CAP) {
    broadcast({ t: 'error', sessionKey, message: 'A retomada automática também falhou — mande a mensagem de novo.' });
    recordIncident({ kind: 'resume-exhausted', sessionKey, sessionId: thread.sessionId, detail: `${tries - 1} retomada(s) e o turno caiu de novo` });
    return;
  }
  autoResumes.set(sessionKey, tries);
  // Avisa aqui, não em quem detectou a morte: só neste ponto a retomada é certa
  // (passou das guardas de corrida acima e do teto de tentativas).
  broadcast({ t: 'error', sessionKey, message: 'Retomando de onde parou…' });
  const p = thread.params;
  startRun(null, sessionKey, RESUME_PROMPT, thread.sessionId, undefined, p.mode, p.model, p.maxBudgetUsd, p.bypass, p.role, p.disallowedSkills, p.mcps, p.effort);
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

// Dispara os itens elegíveis: sessão OCIOSA (sem turno rodando). Drena um item por
// sessão por passada; o item que sobe deixa a sessão ocupada, então o resto da fila
// dela sai no próximo tick (ou no gatilho do onClose). NÃO olha pontuação de uso: se
// o usuário deixou na fila, VAI (regra do Samuel). A única trava é a pausa manual.
function drainParked(): void {
  if (!drainerEnabled) return;
  if (isQueuePaused()) return; // pausa manual do usuário: segura tudo até retomar
  for (const { sessionKey } of parkedHeads()) {
    if (resolveThreadKey(sessionKey)) continue; // turno rodando: um por vez
    const item = shiftParked(sessionKey);
    if (!item) continue;
    // ws null: run sem cliente específico (igual cron); o stream vai por broadcast.
    // resumeId = a sessão onde o item foi enfileirado, pra continuar a conversa.
    startRun(null, sessionKey, item.prompt, item.resumeId, undefined, item.mode, item.model, item.maxBudgetUsd, item.bypass, item.role, item.disallowedSkills, item.mcps, item.effort);
  }
}

let parkedTimer: ReturnType<typeof setInterval> | null = null;
// Liga o drainer (só no agente). Varre a cada 30s: dispara a fila assim que a sessão
// fica ociosa, sem depender do browser aberto. unref: não segura o event loop no shutdown.
export function startParkedDrainer(intervalMs = 30_000): void {
  drainerEnabled = true;
  if (parkedTimer) return;
  parkedTimer = setInterval(drainParked, intervalMs);
  parkedTimer.unref?.();
}

// Retoma no boot os turnos que o restart do agente matou. Sem isto o usuário fica
// com o chat mudo até reclamar: os `claude -p` filhos morrem junto do agente e não
// sobra ninguém pra perceber (o onClose nem chega a rodar). takeOrphanRuns já zera
// o registro, então um crash-loop não re-dispara os mesmos turnos em cascata.
export function resumeOrphanRuns(): void {
  for (const o of takeOrphanRuns()) {
    // Chaveia pelo sessionId, não pela key salva: uma sessão nova nasce com key
    // 'new-…' e o mapeamento pro id real vive no cliente, que o restart derrubou —
    // retomar na key velha viraria um chat fantasma que ninguém vê. Também dedupa
    // contra a sessão que o usuário já reenviou na mão.
    const key = o.sessionId;
    if (!SESSION_KEY_RE.test(key) || threads.has(key)) continue;
    broadcast({ t: 'error', sessionKey: key, message: 'O agente reiniciou e interrompeu este turno. Retomando de onde parou…' });
    recordIncident({ kind: 'orphan-resume', sessionKey: key, sessionId: o.sessionId, detail: `turno órfão de restart, ${Math.round((Date.now() - o.startedAt) / 1000)}s de vida` });
    const p = o.params ?? {};
    startRun(null, key, RESUME_PROMPT, o.sessionId, undefined, p.mode, p.model, p.maxBudgetUsd, p.bypass, p.role, p.disallowedSkills, p.mcps, p.effort);
  }
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
  // Turno NOVO (não uma retomada nossa) devolve a cota de retomada da sessão. Só o
  // fechamento saudável zerava, então um turno morto que não fechou saudável (ex.:
  // reapado) deixava a cota gasta pra sempre e a próxima falha de verdade era
  // recusada com "a retomada automática também falhou".
  if (prompt !== RESUME_PROMPT) autoResumes.delete(sessionKey);

  let live = false; // este turno já foi registrado no live-runs.json?
  const thread: Thread = { handle: { kill: () => {} }, params: { mode, model, maxBudgetUsd, bypass, role, disallowedSkills, mcps, effort }, prompt, startedAt: Date.now(), sessionId: resumeId, text: '', thinking: '', tools: [], toolStart: new Map(), taskNotifies: new Map(), tasks: new Map(), taskCreates: new Map() };
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
    onEvent: (ev) => {
      translate(sessionKey, thread, ev);
      // Registra o turno em disco assim que o sessionId aparece. É o que permite
      // retomá-lo quando o PROCESSO INTEIRO morre (restart/OOM/deploy): aí o onClose
      // não roda e a retomada em memória não existe mais. Só o agente escreve, pelo
      // mesmo motivo do drainer: dois processos no mesmo arquivo = retomada dobrada.
      if (!live && drainerEnabled && thread.sessionId) {
        live = true;
        markRunLive({ sessionKey, sessionId: thread.sessionId, params: thread.params, startedAt: thread.startedAt });
      }
    },
    onError: (message) => {
      broadcast({ t: 'error', sessionKey, message });
      recordIncident({ kind: 'run-error', sessionKey, sessionId: thread.sessionId, detail: message.slice(0, 400) });
    },
    onClose: () => {
      // Se este thread já foi substituído por um run mais novo na mesma key
      // (re-send que matou o anterior), o onClose do antigo NÃO deve mandar um
      // 'done' prematuro nem apagar a entrada do novo run.
      if (threads.get(sessionKey) !== thread) return;
      if (live && !preserveLiveOnClose) clearRunLive(sessionKey); // fechou: não é mais órfão (salvo no shutdown, onde o boot retoma)
      // Turno que morreu no meio sem dizer nada: avisa ANTES do 'done' (a bolha de
      // erro entra acima do rodapé de conclusão) e retoma sozinho logo abaixo. Um
      // fechamento saudável zera o contador pra a próxima falha ter direito a
      // retomada — senão um incidente antigo consumiria a cota da sessão pra sempre.
      const silent = isSilentDeath(thread);
      if (silent) {
        broadcast({ t: 'error', sessionKey, message: 'O turno caiu antes de terminar (o processo morreu sem resposta).' });
        recordIncident({ kind: 'silent-death', sessionKey, sessionId: thread.sessionId, detail: `${Math.round((Date.now() - thread.startedAt) / 1000)}s vivo, ${thread.tools.length} tools, ${thread.text.length} chars de resposta` });
      }
      else if (!thread.reaped) autoResumes.delete(sessionKey);
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
      // Por último: as filas têm prioridade sobre a retomada (o que o usuário mandou
      // vale mais que continuar um turno morto), e autoResume só age se ninguém pegou.
      // Turno reapado entra aqui junto da morte silenciosa: ele foi morto por NÓS, não
      // pelo usuário, então tem que voltar sozinho (com o teto de 1 tentativa). Exceto
      // 'total': esse teto existe justamente pra parar um run desgovernado — retomar
      // dobraria a queima que o teto tentou conter.
      if (silent || (thread.reaped && thread.reaped !== 'total')) autoResume(sessionKey, thread);
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
