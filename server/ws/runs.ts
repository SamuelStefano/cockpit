import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { Cron } from '../../shared/protocol';
import { run } from '../engine/claude';
import { CONFIG } from '../config';
import type { Role } from '../auth';
import { broadcast, send } from './broadcast';
import { detach } from './detach';
import { translate } from './translate';
import { summarize } from '../summary';
import { classify, quickAnswer } from '../engine/triage';
import { suggestFollowups } from '../engine/suggest';
import { isAwaiting, clearAwaiting } from './awaiting';
import { parkedHeads, shiftParked, unshiftParked, addParked, findParked, takeParked, promoteParked, parkedView, isQueuePaused, MAX_PARKED_ATTEMPTS, REJECT_MESSAGE, type ParkedItem } from './parked';
import { resumableId } from './resume';
import { quotaHold, burnedByQuota } from './quota';
import { markRunLive, clearRunLive, takeOrphanRuns } from './recover';
import { recordIncident } from './incidents';
import { threadIsMarathon, MARATHON_AUTO_RESUME_CAP } from './marathon';
import { threads, admitRun, resolveThreadKey, stopSession, stopEpochOf, clearStopEpoch, shouldPreserveLive, runParams, sameParams, type Thread, type RunParams } from './threads';
import { enqueuePending, hasPending, takePendingBatch, takeAllPending, type QueuedSend } from './pending';

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
  if (isAwaiting(sessionKey)) return;           // turno aguarda resposta do usuário
  if (!thread.sessionId) return;                // sem sessionId não há --resume possível
  // O fork já nasce com o sessionId cravado, antes de o CLI escrever o JSONL: se ele
  // morreu cedo, `--resume` apontaria pra um transcript que não existe e morreria de novo.
  if (!resumableId(thread.sessionId)) return;
  const tries = (autoResumes.get(sessionKey) ?? 0) + 1;
  const cap = threadIsMarathon(sessionKey, thread.sessionId) ? MARATHON_AUTO_RESUME_CAP : AUTO_RESUME_CAP;
  if (tries > cap) {
    broadcast({ t: 'error', sessionKey, message: 'A retomada automática também falhou — mande a mensagem de novo.' });
    recordIncident({ kind: 'resume-exhausted', sessionKey, sessionId: thread.sessionId, detail: `${tries - 1} retomada(s) e o turno caiu de novo` });
    return;
  }
  autoResumes.set(sessionKey, tries);
  // Avisa aqui, não em quem detectou a morte: só neste ponto a retomada é certa
  // (passou das guardas de corrida acima e do teto de tentativas).
  broadcast({ t: 'error', sessionKey, message: 'Retomando de onde parou…' });
  startRun({ ...thread.params, ws: null, sessionKey, prompt: RESUME_PROMPT, resumeId: thread.sessionId });
}

// --- drainer da fila ESTACIONADA (overnight/quota-out) ----------------------

// Só o processo do AGENTE liga o drainer (startParkedDrainer). Sem esta trava, o
// index (loopback) e o agente (relay) rodariam o mesmo dreno lendo o parked.json
// compartilhado → dois shifts do mesmo item = envio dobrado. O gatilho no onClose
// também respeita esta flag.
let drainerEnabled = false;

// Dispara os itens elegíveis: sessão OCIOSA (sem turno rodando). Drena um item por
// sessão por passada; o item que sobe deixa a sessão ocupada, então o resto da fila
// dela sai no próximo tick (ou no gatilho do onClose). Travas: pausa manual e teto de
// tokens — fora isso, se o usuário deixou na fila, VAI (regra do Samuel).
export function drainParked(): void {
  if (!drainerEnabled) return;
  if (isQueuePaused()) return; // pausa manual do usuário: segura tudo até retomar
  if (quotaHold()) return;     // sem token: o turno morreria no limite e o prompt seria queimado
  for (const { sessionKey, first } of parkedHeads()) {
    if (first.held) continue;                   // bateu o teto de tentativas: espera o usuário mandar retomar
    // Turno parou numa pergunta: o translate mata o run pra o card ficar respondível,
    // então a sessão fica ociosa e o drainer a via como livre. O item subia como se
    // fosse a resposta — a pergunta virava passado (prompt humano depois dela) e o
    // card sumia sem nunca ter sido respondido. Só a resposta do usuário (ou o
    // queue-force) destrava.
    if (isAwaiting(sessionKey)) continue;
    if (resolveThreadKey(sessionKey)) continue; // turno rodando: um por vez
    const item = shiftParked(sessionKey);
    if (!item) continue;
    // ws null: run sem cliente específico (igual cron); o stream vai por broadcast.
    // resumeId = a sessão onde o item foi enfileirado, pra continuar a conversa —
    // se aquele transcript não existe mais, roda como turno novo em vez de morrer.
    const resume = resumableId(item.resumeId);
    if (item.resumeId && !resume) recordIncident({ kind: 'parked-resume-morto', sessionKey, sessionId: item.resumeId, detail: `item ${item.id} disparado como turno novo` });
    startRun({ ...runParams(item), ws: null, sessionKey, prompt: item.prompt, resumeId: resume });
    // O run pode nem ter subido (teto de sessões simultâneas): sem isto o item já
    // saiu do disco e o prompt sumia. Subiu = fica amarrado ao thread pra voltar
    // pra fila se o teto de tokens matar o turno.
    const th = threads.get(sessionKey);
    if (th) th.parked = item;
    else unshiftParked(sessionKey, item);
    // O item saiu (ou voltou) do parked.json: sem este broadcast a fila drenada some
    // do disco mas continua na tela de quem não está na sessão — o drainer roda com
    // ws null e o 'started' do turno não mexe na lista de fila do cliente.
    broadcastQueue();
  }
}

function broadcastQueue(): void {
  broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
}

export type BgRunReject = 'sem-item' | 'sem-contexto' | 'sem-quota' | 'sem-slot' | 'falhou';

// Dispara UM item da fila agora, num chat paralelo, sem esperar a sessão liberar. O
// turno em andamento não é tocado: o fork lê o transcript do chat e grava num id
// novo, então os dois processos nunca escrevem o mesmo JSONL.
// A ordem importa: tudo que pode recusar roda ANTES de tirar o item da fila —
// devolver depois contaria uma tentativa falha que não houve e o item acabaria
// segurado por engano no teto.
export function runParkedInBackground(sessionKey: string, id: string, role?: Role, model?: string): { forkId: string } | { reject: BgRunReject } {
  if (quotaHold()) return { reject: 'sem-quota' };
  const peek = findParked(sessionKey, id);
  if (!peek) return { reject: 'sem-item' };
  // Sem transcript não há o que forkar, e rodar como turno novo perderia justamente
  // o contexto que é o motivo do disparo.
  const parent = resumableId(peek.resumeId);
  if (!parent) return { reject: 'sem-contexto' };
  // O fork nasce com chave nova, então nunca "substitui" um run: se o teto de
  // concorrência já está cheio, o startRun recusaria depois do item já ter saído.
  if (!admitRun(threads.size, false)) return { reject: 'sem-slot' };
  const item = takeParked(sessionKey, id, role);
  if (!item) return { reject: 'sem-item' };
  const forkId = randomUUID();
  startRun({ ...runParams(item), model: model ?? item.model, ws: null, sessionKey: forkId, prompt: item.prompt, resumeId: parent, forkId });
  // Spawn falhou depois do item já ter saído: devolve pro topo SEM contar tentativa
  // (a falha é do disparo, não do prompt) pra ele não acabar segurado no teto.
  const th = threads.get(forkId);
  if (!th) { unshiftParked(sessionKey, item, false); broadcastQueue(); return { reject: 'falhou' }; }
  // Amarra o item ao fork: se ele morrer sem consumir o prompt (teto de tokens,
  // crash, deploy), o onClose devolve — pra fila da sessão ORIGINAL, não a do fork.
  th.parked = item;
  th.parkedFrom = sessionKey;
  return { forkId };
}

export type NowRunReject = 'sem-item' | 'segurado' | 'fila-pausada' | 'sem-quota' | 'aguardando-resposta';

// Fura a fila: o item vai pro topo e o turno em andamento MORRE pra ele subir no
// lugar. Não dispara o item aqui — só promove e mata; o onClose do turno morto já
// chama drainParked, que agora encontra este item no topo. Disparar direto
// competiria com esse dreno pelo mesmo item.
// Tudo que pode recusar roda ANTES do stop: um item segurado ou uma fila pausada
// não subiriam depois, e o usuário teria perdido o turno em andamento à toa.
export function runParkedNow(sessionKey: string, id: string): { ok: true } | { reject: NowRunReject } {
  if (isQueuePaused()) return { reject: 'fila-pausada' };
  if (quotaHold()) return { reject: 'sem-quota' };
  // Pergunta pendente: o drainer ignora a sessão até a resposta, então promover e
  // matar o turno deixaria o item no topo sem nada subir. Recusa aqui em vez de
  // limpar o latch: abrir mão do card é decisão explícita do usuário (queue-force).
  if (isAwaiting(sessionKey)) return { reject: 'aguardando-resposta' };
  const peek = findParked(sessionKey, id);
  if (!peek) return { reject: 'sem-item' };
  if (peek.held) return { reject: 'segurado' }; // no teto de tentativas o drainer o ignora: retomar primeiro
  if (!promoteParked(sessionKey, id)) return { reject: 'sem-item' };
  if (resolveThreadKey(sessionKey)) stopSession(sessionKey);
  else drainParked(); // sessão já ociosa: nada pra matar, só não esperar o tick de 30s
  return { ok: true };
}

let parkedTimer: ReturnType<typeof setInterval> | null = null;
// Liga o drainer (só no agente). Varre a cada 30s: dispara a fila assim que a sessão
// fica ociosa, sem depender do browser aberto. unref: não segura o event loop no shutdown.
export function startParkedDrainer(intervalMs = 30_000): void {
  drainerEnabled = true;
  if (parkedTimer) return;
  parkedTimer = setInterval(drainParked, intervalMs);
  parkedTimer.unref?.();
  // Primeira passada logo no boot: o restart do agente (deploy, OOM) zera o tick, e
  // sem isto a fila ficava parada até o primeiro intervalo mesmo com a sessão ociosa.
  // Depois da retomada dos órfãos (15s), pra não subir um item numa sessão que o
  // resumeOrphanRuns vai reocupar.
  setTimeout(drainParked, Math.min(intervalMs, 16_000)).unref?.();
}

// Devolve o item pro topo da fila. No teto de tentativas pausa a fila inteira: o
// prompt continua guardado (nunca é descartado), mas para de ser redisparado a cada
// 30s por uma falha que se repete.
function requeueParked(sessionKey: string, item: ParkedItem): void {
  const attempts = unshiftParked(sessionKey, item);
  if (attempts >= MAX_PARKED_ATTEMPTS) {
    broadcast({ t: 'error', sessionKey, message: `Este item da fila falhou ${attempts}x sem produzir nada. Ele está guardado e segurado — use "retomar" na fila pra tentar de novo.` });
    recordIncident({ kind: 'parked-requeue-cap', sessionKey, detail: `item ${item.id} devolvido ${attempts}x` });
  }
  broadcastQueue();
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
    // Turno que subiu da fila e morreu antes de produzir qualquer coisa: o prompt do
    // usuário não foi consumido. Devolvê-lo pra fila vale mais que um "continue de
    // onde parou" genérico — não havia de onde continuar, e o drainer o redispara.
    // Vem ANTES das guardas de retomada: elas descartariam o item junto do turno.
    if (o.parked) {
      requeueParked(o.parkedFrom ?? o.sessionKey, o.parked);
      continue;
    }
    const key = o.sessionId;
    if (!SESSION_KEY_RE.test(key) || threads.has(key)) continue;
    broadcast({ t: 'error', sessionKey: key, message: 'O agente reiniciou e interrompeu este turno. Retomando de onde parou…' });
    recordIncident({ kind: 'orphan-resume', sessionKey: key, sessionId: o.sessionId, detail: `turno órfão de restart, ${Math.round((Date.now() - o.startedAt) / 1000)}s de vida` });
    startRun({ ...(o.params ?? {}), ws: null, sessionKey: key, prompt: RESUME_PROMPT, resumeId: o.sessionId });
  }
}

const SESSION_KEY_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export interface StartRunOptions extends RunParams {
  // ws null = run sem cliente específico (cron agendado, dreno da fila): erros vão
  // por broadcast e o stream é broadcastado a todos os clientes como qualquer run.
  ws: WebSocket | null;
  sessionKey: string;
  prompt: string;
  resumeId?: string;
  msgId?: string;
  // Prompt que o CLIENTE disparou sozinho (flush automático da fila dele), não um
  // envio manual do usuário. Só ele respeita o latch de pergunta pendente.
  auto?: boolean;
  // O turno lê o transcript do `resumeId` mas grava nesse id novo, então a sessão
  // original segue intocada — usado no disparo em background (chat novo, isolado).
  // Não é herdado pela retomada automática: retomar um fork continua o próprio fork.
  forkId?: string;
}

export function startRun(o: StartRunOptions) {
  const { ws, sessionKey, prompt, resumeId, msgId, auto, forkId } = o;
  const params = runParams(o);
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
  if (auto && isAwaiting(sessionKey)) {
    if (ws) {
      if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });
      if (!enqueuePending(sessionKey, { ...params, ws, prompt }))
        send(ws, { t: 'error', sessionKey, message: 'fila de mensagens cheia' });
    }
    return;
  }
  if (!auto) clearAwaiting(sessionKey);
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
  let parkedConsumed = false; // o item de fila deste turno já saiu do registro em disco?
  const thread: Thread = { handle: { kill: () => {} }, params, prompt, startedAt: Date.now(), sessionId: forkId ?? resumeId, text: '', thinking: '', tools: [], toolStart: new Map(), taskNotifies: new Map(), tasks: new Map(), taskCreates: new Map(), appTried: new Set() };
  threads.set(sessionKey, thread);
  // Eco da mensagem do usuário a todos os clientes ANTES do 'started' (bolha do
  // usuário aparece antes da do assistente). Só quando o cliente mandou msgId — o
  // dedup no remetente depende de casar o id otimista dele.
  if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });
  broadcast({ t: 'started', sessionKey });

  thread.handle = run({
    ...params,
    prompt,
    resumeId,
    forkId,
    onEvent: (ev) => {
      translate(sessionKey, thread, ev);
      // Registra o turno em disco assim que o sessionId aparece. É o que permite
      // retomá-lo quando o PROCESSO INTEIRO morre (restart/OOM/deploy): aí o onClose
      // não roda e a retomada em memória não existe mais. Só o agente escreve, pelo
      // mesmo motivo do drainer: dois processos no mesmo arquivo = retomada dobrada.
      if (!live && drainerEnabled && thread.sessionId) {
        live = true;
        // O frame que traz o sessionId pode já vir com trabalho junto; nesse caso o
        // item nem chega ao disco, senão um restart tardio reenviaria o que já rodou.
        parkedConsumed = thread.tools.length > 0 || thread.text.trim() !== '';
        markRunLive({ sessionKey, sessionId: thread.sessionId, params: thread.params, startedAt: thread.startedAt, parked: parkedConsumed ? undefined : thread.parked, parkedFrom: thread.parkedFrom });
      }
      // O prompt da fila só fica no registro em disco enquanto o turno não produziu
      // NADA — aí uma morte do processo devolve o item pra fila. Assim que sai a
      // primeira tool/resposta, some do disco: um restart tardio reenviaria trabalho
      // já feito. Em memória ele continua, porque o veredito de teto de tokens no
      // onClose ainda pode devolvê-lo (ver burnedByQuota).
      else if (live && thread.parked && !parkedConsumed && (thread.tools.length > 0 || thread.text.trim() !== '')) {
        parkedConsumed = true;
        if (thread.sessionId) markRunLive({ sessionKey, sessionId: thread.sessionId, params: thread.params, startedAt: thread.startedAt });
      }
    },
    onError: (message) => {
      thread.lastError = message;
      broadcast({ t: 'error', sessionKey, message });
      recordIncident({ kind: 'run-error', sessionKey, sessionId: thread.sessionId, detail: message.slice(0, 400) });
    },
    onClose: () => {
      // Se este thread já foi substituído por um run mais novo na mesma key
      // (re-send que matou o anterior), o onClose do antigo NÃO deve mandar um
      // 'done' prematuro nem apagar a entrada do novo run.
      if (threads.get(sessionKey) !== thread) return;
      if (live && !shouldPreserveLive()) clearRunLive(sessionKey); // fechou: não é mais órfão (salvo no shutdown, onde o boot retoma)
      // Teto de tokens: um veredito só pro fechamento inteiro (devolver o item
      // drenado, segurar as filas e não retomar em cima do limite).
      const hold = quotaHold();
      // Turno que subiu da fila e morreu no limite sem consumir o prompt: devolve o
      // item pro topo em vez de perdê-lo (era o prompt "queimado" do bug).
      const parked = thread.parked;
      thread.parked = undefined;
      // Turno da fila que fechou sem NADA (nem tool, nem texto) não consumiu o prompt,
      // tenha sido teto de tokens ou morte silenciosa do processo. Devolver é sempre
      // melhor que perder: no pior caso o usuário vê o mesmo pedido rodar de novo.
      // Stop do USUÁRIO é a exceção: ele mandou parar, reenfileirar viraria loop. Kill
      // nosso (deploy, guarda de pressão, reaper) não consumiu o prompt e devolve.
      const produced = thread.userStopped || thread.tools.length > 0 || thread.text.trim() !== '';
      if (parked && (!produced || burnedByQuota({ limited: hold > 0, tools: thread.tools.length, text: thread.text }))) {
        requeueParked(thread.parkedFrom ?? sessionKey, parked);
      }
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
      // Turno DESACOMPANHADO (cron agendado, maratona): ninguém vai ler o resumo nem
      // clicar num chip de continuação entre um turno e o próximo, e cada um deles é
      // uma chamada de API paga por turno fechado.
      const unattended = sessionKey.startsWith('cron-') || threadIsMarathon(sessionKey, thread.sessionId);
      if (thread.sessionId && !thread.stopped && !unattended) void summarize(thread.sessionId);
      // Chips de continuação (estilo ChatGPT): só em turno de usuário concluído de
      // verdade (não stop, não cron, não AskUserQuestion pendente) e sem fila — um
      // prompt enfileirado vai rodar já; sugerir tópicos agora seria ruído. Se um
      // turno novo começar antes do haiku voltar, o resultado é descartado.
      if (!thread.stopped && !thread.questioned && !unattended && !hasPending(sessionKey)) {
        void suggestFollowups(thread.prompt, thread.text, sessionKey).then((items) => {
          if (items.length && !threads.has(sessionKey)) broadcast({ t: 'suggestions', sessionKey, items });
        }).catch(() => {});
      }
      threads.delete(sessionKey);
      clearStopEpoch(sessionKey); // época só vive enquanto há turno/triagem; senão vaza monotônico
      // Após AskUserQuestion o turno aguarda a RESPOSTA do usuário (próximo prompt) —
      // não drenar a fila aqui, senão um enfileirado fura na frente da resposta.
      if (!thread.questioned) {
        // Sem token, a fila in-turn (memória) não pode nem rodar nem esperar em RAM:
        // vira fila ESTACIONADA (disco), que drena sozinha no reset.
        if (hold) parkPending(sessionKey, thread.sessionId);
        else {
          drainPending(sessionKey, thread.sessionId);
          // Gatilho da fila estacionada: se a in-turn (pending) não pegou a sessão,
          // dispara o próximo item overnight já, sem esperar o tick de 30s. Self-guard:
          // se drainPending subiu um turno, resolveThreadKey pega e drainParked pula.
          drainParked();
        }
      }
      // Por último: as filas têm prioridade sobre a retomada (o que o usuário mandou
      // vale mais que continuar um turno morto), e autoResume só age se ninguém pegou.
      // Turno reapado entra aqui junto da morte silenciosa: ele foi morto por NÓS, não
      // pelo usuário, então tem que voltar sozinho (com o teto de 1 tentativa). Exceto
      // 'total': esse teto existe justamente pra parar um run desgovernado — retomar
      // dobraria a queima que o teto tentou conter. E sem token não adianta retomar
      // nada: o turno novo morreria no limite igual.
      if ((silent || (thread.reaped && thread.reaped !== 'total')) && !hold) autoResume(sessionKey, thread);
    },
  });
}

// Drena UM prompt enfileirado (triagem 'wait'/'merge') como o próximo turno da
// sessão. Sequencial: o onClose deste turno drena o seguinte. Continua a mesma
// conversa via resumeId (sessionId do turno recém-fechado). merge enquadra como
// complemento explícito.
function drainPending(sessionKey: string, resumeId?: string) {
  const batch = takePendingBatch(sessionKey);
  if (!batch) return;
  const { first, text } = batch;
  // msgId undefined: a bolha do usuário já foi ecoada no routeSend (não duplica).
  startRun({ ...runParams(first), ws: first.ws, sessionKey, prompt: text, resumeId });
}

// Migra a fila in-turn pra fila estacionada quando os tokens acabam: os itens saem
// da memória (que o restart do agente perderia) e passam a esperar o reset no disco,
// no mesmo lugar que o usuário edita/reordena. Sem isto o onClose de um turno morto
// no limite disparava o próximo item contra a mesma sessão sem token.
function parkPending(sessionKey: string, resumeId?: string): void {
  const arr = takeAllPending(sessionKey);
  if (arr.length === 0) return;
  for (const it of arr) {
    const r = addParked(sessionKey, {
      ...runParams(it),
      prompt: it.merge ? `Complemento do pedido anterior:\n\n${it.prompt}` : it.prompt,
      resumeId,
    });
    // Recusa aqui apagaria um prompt que o usuário já mandou: a migração é a última
    // parada dele (a fila in-turn vive só em memória). Avisa em vez de sumir.
    if ('reject' in r) {
      broadcast({ t: 'error', sessionKey, message: `Um prompt em espera não coube na fila (${REJECT_MESSAGE[r.reject]}) e foi perdido. Reenvie: ${it.prompt.slice(0, 120)}` });
      recordIncident({ kind: 'parked-migrate-reject', sessionKey, detail: r.reject });
    }
  }
  broadcastQueue();
}

// Roteia um prompt enviado com o turno da sessão OCUPADO. Ecoa a bolha do usuário
// na hora, pede o veredito ao triador (haiku) e age conforme a decisão (auto).
export interface RouteSendOptions extends RunParams {
  ws: WebSocket;
  sessionKey: string;
  prompt: string;
  resumeId?: string;
  msgId?: string;
}

export async function routeSend(o: RouteSendOptions) {
  const { ws, sessionKey, prompt, resumeId, msgId } = o;
  const params = runParams(o);
  if (typeof sessionKey !== 'string' || !SESSION_KEY_RE.test(sessionKey)) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) { send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' }); return; }
  const cur = threads.get(sessionKey);
  if (!cur) { startRun({ ...params, ws, sessionKey, prompt, resumeId, msgId }); return; } // corrida: turno fechou

  // Bolha do usuário aparece já (antes da decisão da triagem, que leva ~alguns s).
  if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });

  const epoch = stopEpochOf(sessionKey);
  const verdict = await classify(cur.prompt, cur.text, prompt, sessionKey);

  // Stop durante o await da triagem → o usuário pediu silêncio; descarta.
  if (stopEpochOf(sessionKey) !== epoch) return;

  // O turno avaliado pode ter fechado/sido substituído durante o await (~s) do
  // triador. Agir sobre o veredito agora atingiria o turno ERRADO: 'priority'
  // mataria um run que nunca avaliamos (flap/queima de token), 'merge'/'wait'
  // enfileiraria contra outra linhagem. Re-checa identidade antes de agir.
  if (threads.get(sessionKey) !== cur) {
    if (!threads.has(sessionKey)) startRun({ ...params, ws, sessionKey, prompt, resumeId });
    else if (!enqueuePending(sessionKey, { ...params, ws, prompt, merge: false })) {
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
      startRun({ ...params, ws, sessionKey, prompt: carry, resumeId });
      return;
    }
    case 'answer':
      // Fallback: haiku falhou/timeout (retorna '') → NÃO engolir a mensagem em
      // silêncio; degrada pra 'wait' (responde quando o turno fechar).
      detach(ws, runQuickAnswer(sessionKey, prompt, epoch, () => {
        if (!threads.has(sessionKey)) { startRun({ ...params, ws, sessionKey, prompt, resumeId }); return; }
        if (!enqueuePending(sessionKey, { ...params, ws, prompt, merge: false })) {
          broadcast({ t: 'error', sessionKey, message: 'fila de mensagens cheia' });
        }
      }), sessionKey);
      return;
    case 'merge':
    case 'wait':
      if (!enqueuePending(sessionKey, { ...params, ws, prompt, msgId, merge: verdict.action === 'merge' })) {
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
  if (stopEpochOf(sessionKey) !== epoch) return;
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
  startRun({
    ws: null,
    sessionKey: `cron-${cron.id}`,
    prompt: cron.prompt,
    msgId: `cron-${Date.now().toString(36)}`,
    mode: cron.mode,
    model: cron.model,
    effort: cron.effort || 'low',
  });
}
