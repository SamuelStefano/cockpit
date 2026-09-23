import { randomUUID } from 'node:crypto';
import { emitTurnClosed } from '../canvas/turn-hooks';
import type { WebSocket } from 'ws';
import type { Cron, ResumeOfferReason } from '../../shared/protocol';
import { run, resolveMcpSelection } from '../engine/claude';
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
import { getLastPlanUsage, notePlanUsageChanged } from './usage-plan';
import {
  ctxVerdict, verdictMessage, costFor, isBigColdStart, acquireCold, releaseCold,
  noteQuotaTransition, inResetCooldown, type Verdict,
} from './ctx-guard';
import { markRunLive, clearRunLive, takeOrphanRuns } from './recover';
import { recordIncident } from './incidents';
import { readMemInfo, memoryVerdict, nextResumeDelayMs, memoryRunCap } from './mem-guard';
import {
  classifyDeath, externalResumeGate, noteExternalKill, lastExternalKillAt,
  EXTERNAL_POLL_MS, type DeathCause,
} from './kill-class';
import { authHold, isAuthFailure, markAuthBroken, AUTH_MESSAGE } from './auth-health';
import { threadIsMarathon, MARATHON_AUTO_RESUME_CAP } from './marathon';
import { threads, admitRun, resolveThreadKey, stopSession, stopEpochOf, clearStopEpoch, shouldPreserveLive, runParams, sameParams, type Thread, type RunParams } from './threads';
import { isAreaAdmissionBlocked } from '../canvas/autopause-loop';
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

// Pura, testada isolada (canvas review — flows batch #3): decide se um turno
// produziu um resultado REAL o bastante pra virar o prompt de outro nó no
// canvas. A definição antiga (`!stopped && !silent && !questioned && text
// não-vazio`) deixava passar um turno com texto de despedida mas que na
// verdade cortou em budget/max_turns/erro (endReason ≠ success), ou cujo
// texto era só o aviso de auth quebrada / o teto de tokens estourado — nenhum
// dos dois é um resultado que faz sentido encadear.
export interface TurnOutcome { stopped?: boolean; questioned?: boolean; text: string; endReason?: string; lastError?: string }
export interface TurnOutcomeFlags { silent: boolean; authBurned: boolean; quotaBurned: boolean }
export function isCleanTurnClose(t: TurnOutcome, flags: TurnOutcomeFlags): boolean {
  return t.endReason === 'success' && !t.stopped && !t.questioned && !flags.silent
    && !flags.authBurned && !flags.quotaBurned && !t.lastError && t.text.trim() !== '';
}

// Uma retomada automática por incidente. Mais que isso vira loop de queima de
// token quando a causa é permanente (quota estourada, API fora) — o teto garante
// que a falha crônica apareça pro usuário em vez de rodar em círculos.
export const AUTO_RESUME_CAP = 1;
const autoResumes = new Map<string, number>();

// Prompt da retomada: o JSONL sobrevive à morte do processo, então --resume
// reconstrói o contexto inteiro e o turno continua de onde parou.
const RESUME_PROMPT = 'O turno anterior foi interrompido por uma falha do processo. Continue exatamente de onde parou, sem repetir o trabalho já feito.';

// Ofertas de retomada em aberto: turno que morreu e NÃO foi retomado sozinho.
// Guardar a config aqui é o que faz o botão da UI valer um `--resume` de verdade
// em vez de um "reenvie a última mensagem" — o thread já saiu do mapa.
interface ResumeOffer { sessionId: string; params: RunParams; flowHop?: number }
const resumeOffers = new Map<string, ResumeOffer>();

// Nenhum turno pode sumir em silêncio: toda desistência de retomada passa por
// aqui, então a UI sempre recebe o motivo E um caminho de volta.
function offerResume(sessionKey: string, thread: Thread, reason: ResumeOfferReason, message: string): void {
  if (!thread.sessionId || !resumableId(thread.sessionId)) {
    broadcast({ t: 'error', sessionKey, message });
    return;
  }
  resumeOffers.set(sessionKey, { sessionId: thread.sessionId, params: thread.params, flowHop: thread.flowHop });
  broadcast({ t: 'resume-offer', sessionKey, sessionId: thread.sessionId, reason, message });
}

export function hasResumeOffer(sessionKey: string): boolean {
  return resumeOffers.has(sessionKey);
}

// Clique do usuário na oferta. Retomar por vontade dele é intencional: não gasta
// (nem consulta) o teto de retomada automática, que existe pra loop de máquina.
export function acceptResumeOffer(sessionKey: string): boolean {
  const offer = resumeOffers.get(sessionKey);
  if (!offer) return false;
  resumeOffers.delete(sessionKey);
  if (threads.has(sessionKey)) return false;
  autoResumes.delete(sessionKey);
  startRun({ ...offer.params, ws: null, sessionKey, prompt: RESUME_PROMPT, resumeId: offer.sessionId, queued: true, flowHop: offer.flowHop });
  return true;
}

// Retoma o turno morto com a MESMA config. Silencioso quanto a corridas: se a fila
// (pending/parked) ou o usuário já subiram um turno novo, não atropela.
function autoResume(sessionKey: string, thread: Thread): void {
  if (threads.has(sessionKey)) return;          // já há turno novo na sessão
  if (isAwaiting(sessionKey)) return;           // turno aguarda resposta do usuário
  if (!thread.sessionId) return;                // sem sessionId não há --resume possível
  // O fork já nasce com o sessionId cravado, antes de o CLI escrever o JSONL: se ele
  // morreu cedo, `--resume` apontaria pra um transcript que não existe e morreria de novo.
  if (!resumableId(thread.sessionId)) return;
  // Retomar sessão gigante é o pior gasto possível: cache frio garantido (o
  // processo morreu) sobre o contexto inteiro. Em 04/09 uma sessão de 631k
  // auto-retomou e comeu 0,77M sozinha. Aqui a retomada para e o usuário decide.
  if (ctxVerdict({ sessionId: thread.sessionId, usage: getLastPlanUsage() }).kind === 'hard') {
    const c = costFor(thread.sessionId);
    offerResume(sessionKey, thread, 'ctx-hard', `O turno caiu, mas esta sessão está com ~${Math.round(c.ctxTokens / 1000)}k de contexto: retomar custaria ~${c.pctOfWindow}% da janela. Faça o handoff — ou retome mesmo assim.`);
    recordIncident({ kind: 'resume-ctx-cap', sessionKey, sessionId: thread.sessionId, detail: `${c.ctxTokens} tokens; retomada automática cancelada` });
    return;
  }
  const tries = (autoResumes.get(sessionKey) ?? 0) + 1;
  const cap = threadIsMarathon(sessionKey, thread.sessionId) ? MARATHON_AUTO_RESUME_CAP : AUTO_RESUME_CAP;
  if (tries > cap) {
    offerResume(sessionKey, thread, 'exhausted', 'A retomada automática também falhou. O turno está guardado — retome quando quiser.');
    recordIncident({ kind: 'resume-exhausted', sessionKey, sessionId: thread.sessionId, detail: `${tries - 1} retomada(s) e o turno caiu de novo` });
    return;
  }
  autoResumes.set(sessionKey, tries);
  // Avisa aqui, não em quem detectou a morte: só neste ponto a retomada é certa
  // (passou das guardas de corrida acima e do teto de tentativas).
  broadcast({ t: 'error', sessionKey, message: 'Retomando de onde parou…' });
  startRun({ ...thread.params, ws: null, sessionKey, prompt: RESUME_PROMPT, resumeId: thread.sessionId, flowHop: thread.flowHop });
}

// D2 — gate de memória na frente do autoResume: subir --resume com a memória
// ainda estourada é o que queimava a única tentativa (AUTO_RESUME_CAP) em 5-10s,
// no mesmo incidente que matou o turno. Enquanto a memória estiver 'low', espera
// com backoff SEM contar tentativa — o cap real só é gasto quando a retomada
// roda de fato. Todas as guardas de corrida (threads.has, isAwaiting, etc.) vivem
// dentro de autoResume() e são reavaliadas do zero a cada disparo do timer.
interface ResumeWait { waitedMs: number; backoffAttempt: number }

function maybeAutoResume(sessionKey: string, thread: Thread, cause: DeathCause, wait: ResumeWait = { waitedMs: 0, backoffAttempt: 1 }): void {
  // Um turno novo já pegou a sessão enquanto esperávamos: nada a retomar, e
  // atropelá-lo seria pior que não retomar.
  if (threads.has(sessionKey)) return;
  // Sinal EXTERNO (deploy, varredura do earlyoom, pkill): o processo não quebrou,
  // alguém o matou — e quem matou costuma matar todos os irmãos na mesma rajada e
  // subir um processo novo em seguida. Re-disparar agora entrega o `--resume` de
  // volta à mesma condição: foi assim que a única tentativa do AUTO_RESUME_CAP
  // virou 'resume-exhausted' em 5s no incidente de 17/09. Espera a rajada PARAR
  // (cada irmão que morre empurra a janela) sem contar tentativa nenhuma.
  if (cause === 'external-signal') {
    const gate = externalResumeGate({ lastKillAt: lastExternalKillAt(), now: Date.now(), waitedMs: wait.waitedMs });
    if (gate === 'give-up') {
      offerResume(sessionKey, thread, 'external-kill', 'Algo fora do Deck segue matando os turnos (deploy em loop ou o sistema sem memória). Não vou retomar sozinho em cima disso — retome quando a máquina assentar.');
      recordIncident({ kind: 'external-kill-give-up', sessionKey, sessionId: thread.sessionId, detail: `${Math.round(wait.waitedMs / 1000)}s esperando a rajada parar` });
      return;
    }
    if (gate === 'wait') {
      const timer = setTimeout(
        () => maybeAutoResume(sessionKey, thread, cause, { ...wait, waitedMs: wait.waitedMs + EXTERNAL_POLL_MS }),
        EXTERNAL_POLL_MS,
      );
      timer.unref?.();
      return;
    }
  }
  if (memoryVerdict(readMemInfo()) === 'ok') { autoResume(sessionKey, thread); return; }
  const delay = nextResumeDelayMs(wait.backoffAttempt);
  // Orçamento de espera (~30min) esgotado: desiste de esperar e tenta mesmo assim
  // — cai no fluxo normal, que consome o cap de verdade e relata 'resume-exhausted'
  // como sempre se a memória continuar ruim. Preso pra sempre seria pior que isso.
  if (delay === null) { autoResume(sessionKey, thread); return; }
  const timer = setTimeout(
    () => maybeAutoResume(sessionKey, thread, cause, { waitedMs: wait.waitedMs + delay, backoffAttempt: wait.backoffAttempt + 1 }),
    delay,
  );
  timer.unref?.();
}

// --- drainer da fila ESTACIONADA (overnight/quota-out) ----------------------

// Só o processo do AGENTE liga o drainer (startParkedDrainer). Sem esta trava, o
// index (loopback) e o agente (relay) rodariam o mesmo dreno lendo o parked.json
// compartilhado → dois shifts do mesmo item = envio dobrado. O gatilho no onClose
// também respeita esta flag.
let drainerEnabled = false;

// server/canvas/flows.ts: on a process without the drainer (e.g. the loopback
// index, per the comment above), addParked's item would just sit on disk
// forever — nobody here ever ticks the queue. Use the in-process pending
// queue (server/ws/pending.ts) instead when this is false.
export function isDrainerEnabled(): boolean {
  return drainerEnabled;
}

// Teto de disparos por passada. O `quotaHold` é binário (só segura em 100%), então
// sem este teto a virada da janela soltava TODA sessão estacionada na mesma passada:
// 5 sessões Opus subiram em 21ms logo após um reset e torraram o ciclo novo em
// segundos. Um por passada espalha a fila pelo tick de 30s e devolve ao hold a chance
// de reagir antes do próximo disparo.
export const MAX_DRAIN_PER_PASS = 1;

// Dispara os itens elegíveis: sessão OCIOSA (sem turno rodando). Drena um item por
// sessão por passada; o item que sobe deixa a sessão ocupada, então o resto da fila
// dela sai no próximo tick (ou no gatilho do onClose). Travas: pausa manual e teto de
// tokens — fora isso, se o usuário deixou na fila, VAI (regra do Samuel).
export function drainParked(): void {
  if (!drainerEnabled) return;
  // D2 — memória apertada: não dispara (e não conta tentativa nenhuma, o item
  // continua no topo). O próximo tick de 30s reavalia sozinho.
  if (memoryVerdict(readMemInfo()) === 'low') return;
  // A transição hold>0 -> 0 é lida ANTES da pausa manual: com a fila pausada
  // durante um reset, o cooldown nunca armava e o primeiro dreno após retomar
  // subia em cima da janela recém-virada.
  const hold = quotaHold();
  noteQuotaTransition(hold);
  if (isQueuePaused()) return; // pausa manual do usuário: segura tudo até retomar
  if (authHold()) return;      // dead OAuth login: every fired prompt would die until /login
  if (hold) return;            // sem token: o turno morreria no limite e o prompt seria queimado
  // Janela recém-virada: em 04/09 uma sessão de 631k subiu 1 MINUTO após o reset e
  // já tinha comido 0,77M do ciclo novo quando o Samuel abriu o Deck. O #519
  // espalha a fila pelo tick de 30s; este cooldown dá ao poll de usage (60s) tempo
  // de trazer o número novo antes do primeiro disparo.
  if (inResetCooldown()) return;
  let fired = 0;
  for (const { sessionKey, first } of parkedHeads()) {
    if (fired >= MAX_DRAIN_PER_PASS) break;
    // Reavaliado a cada disparo: o turno que acabou de subir pode ter estourado a
    // janela, e o teto lido só no topo do dreno deixaria o resto da fila subir em
    // cima de uma quota que já acabou.
    if (quotaHold()) break;
    if (first.held) continue;                   // bateu o teto de tentativas: espera o usuário mandar retomar
    // Turno parou numa pergunta: o translate mata o run pra o card ficar respondível,
    // então a sessão fica ociosa e o drainer a via como livre. O item subia como se
    // fosse a resposta — a pergunta virava passado (prompt humano depois dela) e o
    // card sumia sem nunca ter sido respondido. Só a resposta do usuário (ou o
    // queue-force) destrava.
    if (isAwaiting(sessionKey)) continue;
    if (resolveThreadKey(sessionKey)) continue; // turno rodando: um por vez
    // Área do canvas estourou o orçamento (autopause ligado): não readmite trabalho
    // DESACOMPANHADO ali — senão o item sobe, autopause para de novo em ~30s, e o
    // dreno tenta de novo no próximo tick (stop→drain→stop). O chat manual do
    // usuário não passa por drainParked, só a fila estacionada.
    if (isAreaAdmissionBlocked(first.resumeId, sessionKey)) {
      console.log(`[canvas-autopause] pulando dreno de ${sessionKey}: área sob orçamento estourado`);
      continue;
    }
    // Veredito ANTES do shift: um item devolvido pelo `unshiftParked` lá embaixo
    // conta tentativa, e uma sessão travada aqui esgotaria MAX_PARKED_ATTEMPTS em
    // minutos — o prompt acabaria `held` por uma condição que não é culpa dele.
    // Deixando na fila, ele sobe sozinho quando a condição passar.
    //
    // O teto DURO de contexto NÃO barra a fila (regra do Samuel): item enfileirado
    // é intenção explícita do usuário, igual ao envio manual. Antes ele virava um
    // "erro, tente de novo" a cada tick numa sessão que só destravava com handoff.
    // Só quota (sem janela) e cold-busy (transitório) seguram — e em silêncio, que
    // o próximo tick resolve.
    const pre = ctxVerdict({ sessionId: first.resumeId, sessionKey, usage: getLastPlanUsage() });
    if (pre.kind === 'quota' || pre.kind === 'cold-busy') continue;
    const item = shiftParked(sessionKey);
    if (!item) continue;
    // ws null: run sem cliente específico (igual cron); o stream vai por broadcast.
    // resumeId = a sessão onde o item foi enfileirado, pra continuar a conversa —
    // se aquele transcript não existe mais, roda como turno novo em vez de morrer.
    const resume = resumableId(item.resumeId);
    if (item.resumeId && !resume) recordIncident({ kind: 'parked-resume-morto', sessionKey, sessionId: item.resumeId, detail: `item ${item.id} disparado como turno novo` });
    startRun({ ...runParams(item), ws: null, sessionKey, prompt: item.prompt, resumeId: resume, queued: true });
    // O run pode nem ter subido (teto de sessões simultâneas): sem isto o item já
    // saiu do disco e o prompt sumia. Subiu = fica amarrado ao thread pra voltar
    // pra fila se o teto de tokens matar o turno.
    const th = threads.get(sessionKey);
    // Só conta o que virou turno de verdade: um item devolvido não gastou quota, e
    // gastar o teto da passada com ele seguraria a fila sem motivo.
    if (th) { th.parked = item; fired++; }
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
  // O fork LÊ o transcript inteiro do pai: é cold-start do tamanho da sessão de
  // origem, não um turno novo barato. Ainda assim o teto de contexto não barra —
  // clicar "rodar em background" num item da fila é intenção explícita, igual ao
  // envio manual. Quota e cold-busy seguram (janela de verdade acabando).
  const v = ctxVerdict({ sessionId: peek.resumeId, usage: getLastPlanUsage() });
  if (v.kind === 'quota' || v.kind === 'cold-busy') return { reject: 'sem-quota' };
  // Sem transcript não há o que forkar, e rodar como turno novo perderia justamente
  // o contexto que é o motivo do disparo.
  const parent = resumableId(peek.resumeId);
  if (!parent) return { reject: 'sem-contexto' };
  // O fork nasce com chave nova, então nunca "substitui" um run: se o teto de
  // concorrência já está cheio, o startRun recusaria depois do item já ter saído.
  // D5: teto reduzido dinamicamente pela memória livre no instante da admissão.
  if (!admitRun(threads.size, false, memoryRunCap(readMemInfo().availMb, CONFIG.maxConcurrentRuns, threads.size))) return { reject: 'sem-slot' };
  const item = takeParked(sessionKey, id, role);
  if (!item) return { reject: 'sem-item' };
  const forkId = randomUUID();
  startRun({ ...runParams(item), model: model ?? item.model, ws: null, sessionKey: forkId, prompt: item.prompt, resumeId: parent, forkId, queued: true });
  // Spawn falhou depois do item já ter saído: devolve pro topo SEM contar tentativa
  // (a falha é do disparo, não do prompt) pra ele não acabar segurado no teto.
  const th = threads.get(forkId);
  if (!th) { unshiftParked(sessionKey, item, false); broadcastQueue(); return { reject: 'falhou' }; }
  // Amarra o item ao fork: se ele morrer sem consumir o prompt (teto de tokens,
  // crash, deploy), o onClose devolve — pra fila da sessão ORIGINAL, não a do fork.
  th.parked = item;
  th.parkedFrom = sessionKey;
  // Disparo explícito do usuário (clique em "rodar em background"), não o
  // dreno passivo — canvas/autopause.ts nunca para isto (review #595 point 1).
  th.parkedForced = true;
  return { forkId };
}

export type NowRunReject = 'sem-item' | 'segurado' | 'fila-pausada' | 'sem-quota' | 'aguardando-resposta' | 'falhou';

// Fura a fila: o item roda AGORA neste chat, no lugar do turno em andamento.
// Tudo que pode recusar roda ANTES do stop: um item segurado ou uma fila pausada
// não subiriam depois, e o usuário teria perdido o turno em andamento à toa.
//
// Quando ESTE processo é dono do turno, o item sobe AQUI, direto — antes o botão
// só promovia e matava, e contava com o `drainParked` do onClose pra subir o item.
// Esse dreno é um no-op fora do processo do agente (`drainerEnabled`), e o Deck roda
// dois processos sobre o MESMO parked.json (index na :7777 + agente do relay): o
// clique vindo pelo index matava o turno e não subia nada. O drainer do agente só
// pegava o item no tick seguinte, com a UI do index sem ver turno nenhum.
export function runParkedNow(sessionKey: string, id: string, role?: Role): { ok: true } | { reject: NowRunReject } {
  if (isQueuePaused()) return { reject: 'fila-pausada' };
  if (quotaHold()) return { reject: 'sem-quota' };
  // Pergunta pendente: o drainer ignora a sessão até a resposta, então promover e
  // matar o turno deixaria o item no topo sem nada subir. Recusa aqui em vez de
  // limpar o latch: abrir mão do card é decisão explícita do usuário (queue-force).
  if (isAwaiting(sessionKey)) return { reject: 'aguardando-resposta' };
  const peek = findParked(sessionKey, id);
  if (!peek) return { reject: 'sem-item' };
  if (peek.held) return { reject: 'segurado' }; // no teto de tentativas o drainer o ignora: retomar primeiro
  // Sessão ociosa aqui: promove e deixa o drainer subir. Disparar direto seria
  // apostar que nenhum outro processo tem turno vivo nesta sessão — e dois
  // `claude -p --resume` no mesmo transcript se atropelam.
  if (!resolveThreadKey(sessionKey)) {
    if (!promoteParked(sessionKey, id)) return { reject: 'sem-item' };
    drainParked();
    return { ok: true };
  }
  // Tira o item ANTES de matar o turno: assim o dreno do onClose não compete por
  // ele, e uma falha do spawn devolve o item SEM contar tentativa (igual ao
  // disparo em background) — a falha é do disparo, não do prompt.
  const item = takeParked(sessionKey, id, role);
  if (!item) return { reject: 'sem-item' };
  stopSession(sessionKey);
  const resume = resumableId(item.resumeId);
  if (item.resumeId && !resume) recordIncident({ kind: 'parked-resume-morto', sessionKey, sessionId: item.resumeId, detail: `item ${item.id} disparado como turno novo` });
  startRun({ ...runParams(item), ws: null, sessionKey, prompt: item.prompt, resumeId: resume, queued: true });
  const th = threads.get(sessionKey);
  if (!th) { unshiftParked(sessionKey, item, false); broadcastQueue(); return { reject: 'falhou' }; }
  th.parked = item;
  // Explicit user click (queue-force), not the passive drainer — never a
  // stoppable candidate for canvas/autopause.ts (review #595 point 1).
  th.parkedForced = true;
  broadcastQueue();
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
// bump=false (autopause do canvas): a devolução NÃO conta tentativa — a falha é do
// orçamento da área, não do item, e contá-la aproximaria o item do teto de 3 por um
// motivo que não é dele.
function requeueParked(sessionKey: string, item: ParkedItem, bump = true): void {
  const attempts = unshiftParked(sessionKey, item, bump);
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
    // Mesma regra do autoResume: o restart do agente derruba TODOS os turnos de
    // uma vez, então retomar sem olhar o tamanho é exatamente a rajada de
    // cold-starts simultâneos do incidente, só que disparada pelo deploy.
    if (ctxVerdict({ sessionId: o.sessionId, usage: getLastPlanUsage() }).kind === 'hard') {
      const c = costFor(o.sessionId);
      broadcast({ t: 'error', sessionKey: key, message: `O agente reiniciou e interrompeu este turno. Esta sessão está com ~${Math.round(c.ctxTokens / 1000)}k de contexto — não vou retomar sozinho (custaria ~${c.pctOfWindow}% da janela). Faça o handoff.` });
      recordIncident({ kind: 'resume-ctx-cap', sessionKey: key, sessionId: o.sessionId, detail: `${c.ctxTokens} tokens; retomada de órfão cancelada` });
      continue;
    }
    broadcast({ t: 'error', sessionKey: key, message: 'O agente reiniciou e interrompeu este turno. Retomando de onde parou…' });
    recordIncident({ kind: 'orphan-resume', sessionKey: key, sessionId: o.sessionId, detail: `turno órfão de restart, ${Math.round((Date.now() - o.startedAt) / 1000)}s de vida` });
    startRun({ ...(o.params ?? {}), ws: null, sessionKey: key, prompt: RESUME_PROMPT, resumeId: o.sessionId, flowHop: o.flowHop });
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
  // Turno que veio da FILA do usuário (dreno estacionado, disparo em background).
  // Roda sem cliente (ws null), mas o prompt é intenção explícita dele — então o
  // teto duro de contexto não o barra, igual ao envio manual.
  queued?: boolean;
  // Profundidade da cadeia de fluxos do canvas que entregou este prompt (ver
  // Thread.flowHop em threads.ts). Ausente/0 = não veio de um fluxo. Carregado
  // explicitamente pelas retomadas (autoResume, órfão de restart) pra não
  // resetar de graça o teto MAX_HOPS a cada queda do turno.
  flowHop?: number;
}

// Recusa do gate de contexto. Com cliente: devolve o texto pro composer (a bolha
// otimista já está na tela, então o msgId vai junto pra ela ser removida). Sem
// cliente (drainer, cron, retomada): vira erro por broadcast + incidente, porque
// não há composer pra devolver — quem chamou é que decide o destino do item.
function rejectRun(a: { ws: WebSocket | null; sessionKey: string; prompt: string; msgId?: string; verdict: Verdict }): void {
  const { ws, sessionKey, prompt, msgId, verdict } = a;
  const message = verdictMessage(verdict);
  const reason = verdict.kind === 'hard' ? 'ctx-hard' : verdict.kind === 'quota' ? 'quota-insufficient' : 'cold-busy';
  if (ws) {
    send(ws, {
      t: 'send-reject', sessionKey, reason, text: prompt, msgId, message,
      ctxTokens: verdict.cost.ctxTokens, pctOfWindow: verdict.cost.pctOfWindow,
    });
  } else {
    broadcast({ t: 'error', sessionKey, message });
  }
  // Só o hard vira incidente: ele exige ação humana (handoff) e some do radar se
  // ficar só numa bolha. quota/cold-busy são transitórios e o próprio tick resolve.
  if (verdict.kind === 'hard') {
    recordIncident({ kind: 'ctx-hard', sessionKey, detail: `${verdict.cost.ctxTokens} tokens de contexto; envio custaria ~${verdict.cost.pctOfWindow}% da janela` });
  }
}

// Envio COM cliente que não cabe agora (janela no fim, outro cold-start subindo)
// vai pra fila estacionada em vez de voltar como erro: o drainer já segura quota e
// cold-busy e dispara quando couber. Recusar quebrava a fila deixada pro próximo
// batch — a 99% o composer ainda não pausa (99,5), cada envio e cada item do dreno
// in-turn virava "O turno falhou" e o texto se perdia no draft.
function parkRejected(o: StartRunOptions, verdict: Verdict): boolean {
  if (!o.ws || o.forkId || (verdict.kind !== 'quota' && verdict.kind !== 'cold-busy')) return false;
  const r = addParked(o.sessionKey, { ...runParams(o), prompt: o.prompt, resumeId: o.resumeId });
  if ('reject' in r) return false;
  const message = verdict.kind === 'quota'
    ? `Este envio custaria ~${verdict.cost.pctOfWindow}% da janela e não cabe no que sobrou — entrou na fila e roda sozinho quando a janela virar.`
    : 'Outra sessão grande está subindo agora — o prompt entrou na fila e roda assim que ela assentar.';
  send(o.ws, { t: 'send-parked', sessionKey: o.sessionKey, msgId: o.msgId, message });
  broadcastQueue();
  return true;
}

export function startRun(o: StartRunOptions) {
  const { ws, sessionKey, prompt, resumeId, msgId, auto, forkId, queued, flowHop } = o;
  const params = runParams(o);
  // "Permitir todos os MCPs" chega como o sentinel '*' e é expandido AQUI, não no
  // cliente: a lista concreta fica no thread (retomada, tools.ts, sameParams) já
  // filtrada pelo role, e um MCP adicionado hoje vale no próximo turno.
  const mcps = resolveMcpSelection(params.mcps, params.role);
  if (mcps) params.mcps = mcps;
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

  // Gate de CONTEXTO — antes do latch de pergunta e do admitRun: um envio recusado
  // aqui não pode virar `pending` (esperaria a vez pra ser recusado de novo) nem
  // ocupar slot. Vem depois das validações de forma porque precisa do sessionId.
  //
  // O teto DURO ('hard') só barra turno que a MÁQUINA disparou sozinha — retomada
  // automática, cron. Foi isso que queimou a janela em 04/09; o Samuel digitando
  // nunca foi o problema. Barrar o envio manual transformava o aviso em porta
  // trancada: a sessão só aceitava migrar, e migrar é decisão dele.
  // A FILA conta como intenção dele também: um item enfileirado é um prompt que
  // ele escreveu e mandou rodar, só que mais tarde. Antes ele apanhava de "erro,
  // tente de novo" a cada tick do dreno. Quem avisa continua sendo o
  // SaturationBanner + o custo do envio no composer.
  const intentional = (!!ws && !auto) || !!queued;
  const verdict = ctxVerdict({ sessionId: resumeId, sessionKey, usage: getLastPlanUsage() });
  const blocking = verdict.kind === 'quota' || verdict.kind === 'cold-busy' || (verdict.kind === 'hard' && !intentional);
  if (blocking) {
    if (parkRejected(o, verdict)) return;
    rejectRun({ ws, sessionKey, prompt, msgId, verdict });
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
  // D5: teto de concorrência efetivo = min(config, memória livre / ~350MB por
  // turno). `replacing` sempre passa (substituir a própria sessão nunca soma
  // uma sessão nova); a fila (parkRejected acima já tratou o gate de contexto)
  // segue intacta — o item recusado aqui só não sobe AGORA.
  const effCap = memoryRunCap(readMemInfo().availMb, CONFIG.maxConcurrentRuns, threads.size);
  if (!admitRun(threads.size, replacing, effCap)) {
    if (ws) {
      const message = effCap < CONFIG.maxConcurrentRuns
        ? 'A máquina está com pouca memória livre agora — espere a memória liberar e tente de novo.'
        : 'limite de sessões simultâneas atingido';
      send(ws, { t: 'error', sessionKey, message });
    }
    return;
  }
  if (replacing) threads.get(sessionKey)!.handle.kill();
  // Turno NOVO (não uma retomada nossa) devolve a cota de retomada da sessão. Só o
  // fechamento saudável zerava, então um turno morto que não fechou saudável (ex.:
  // reapado) deixava a cota gasta pra sempre e a próxima falha de verdade era
  // recusada com "a retomada automática também falhou".
  if (prompt !== RESUME_PROMPT) autoResumes.delete(sessionKey);
  // Turno novo na sessão: a oferta pendente do turno morto perdeu o sentido (e
  // clicá-la depois atropelaria este run).
  resumeOffers.delete(sessionKey);

  // Cold-start grande ocupa o semáforo até o onClose. Sem isto o gate acima veria
  // sempre zero em voo e os quatro envios de 04/09 passariam iguais.
  // `else releaseCold`: no caminho `replacing` o onClose do turno morto sai cedo
  // (o thread do mapa já é outro) e nunca soltaria a chave. Se o turno novo não é
  // cold-start, ela vazaria e travaria a fila pra sempre.
  const holdsCold = isBigColdStart(verdict.cost);
  if (holdsCold) acquireCold(sessionKey);
  else releaseCold(sessionKey);

  let live = false; // este turno já foi registrado no live-runs.json?
  let parkedConsumed = false; // o item de fila deste turno já saiu do registro em disco?
  const thread: Thread = { handle: { kill: () => {} }, params, prompt, startedAt: Date.now(), sessionId: forkId ?? resumeId, text: '', thinking: '', tools: [], toolStart: new Map(), taskNotifies: new Map(), tasks: new Map(), taskCreates: new Map(), appTried: new Set(), flowHop };
  threads.set(sessionKey, thread);
  // Eco da mensagem do usuário a todos os clientes ANTES do 'started' (bolha do
  // usuário aparece antes da do assistente). Só quando o cliente mandou msgId — o
  // dedup no remetente depende de casar o id otimista dele.
  if (msgId) broadcast({ t: 'user', sessionKey, id: msgId, text: prompt, ts: Date.now() });
  // Carimba o modelo PEDIDO na bolha desde o start: sem isto a bolha em voo ficava
  // sem modelo e o label caía no seletor vivo, mudando retroativamente ao trocar de
  // modelo. O 'done' refina pro efetivo (revela fallback silencioso).
  broadcast({ t: 'started', sessionKey, model: params.model });

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
        markRunLive({ sessionKey, sessionId: thread.sessionId, params: thread.params, startedAt: thread.startedAt, parked: parkedConsumed ? undefined : thread.parked, parkedFrom: thread.parkedFrom, flowHop: thread.flowHop });
      }
      // O prompt da fila só fica no registro em disco enquanto o turno não produziu
      // NADA — aí uma morte do processo devolve o item pra fila. Assim que sai a
      // primeira tool/resposta, some do disco: um restart tardio reenviaria trabalho
      // já feito. Em memória ele continua, porque o veredito de teto de tokens no
      // onClose ainda pode devolvê-lo (ver burnedByQuota).
      else if (live && thread.parked && !parkedConsumed && (thread.tools.length > 0 || thread.text.trim() !== '')) {
        parkedConsumed = true;
        if (thread.sessionId) markRunLive({ sessionKey, sessionId: thread.sessionId, params: thread.params, startedAt: thread.startedAt, flowHop: thread.flowHop });
      }
    },
    onError: (raw, exit) => {
      const auth = isAuthFailure(raw);
      const message = auth ? AUTH_MESSAGE : raw;
      thread.lastError = message;
      if (exit) { thread.lastExitCode = exit.code; thread.lastExitSignal = exit.signal ?? null; }
      broadcast({ t: 'error', sessionKey, message });
      if (auth) markAuthBroken(sessionKey);
      else recordIncident({ kind: 'run-error', sessionKey, sessionId: thread.sessionId, detail: message.slice(0, 400) });
    },
    onClose: () => {
      // Se este thread já foi substituído por um run mais novo na mesma key
      // (re-send que matou o anterior), o onClose do antigo NÃO deve mandar um
      // 'done' prematuro nem apagar a entrada do novo run.
      if (threads.get(sessionKey) !== thread) return;
      // ANTES de qualquer dreno: o próximo item veria o semáforo ocupado por um
      // turno que já fechou e cairia em cold-busy à toa.
      if (holdsCold) releaseCold(sessionKey);
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
      // The CLI prints the auth bailout as the turn's only text: nothing was consumed.
      const authBurned = !thread.userStopped && thread.tools.length === 0 && isAuthFailure(thread.text);
      if (authBurned && thread.lastError !== AUTH_MESSAGE) {
        markAuthBroken(sessionKey);
        broadcast({ t: 'error', sessionKey, message: AUTH_MESSAGE });
      }
      // Autopause do canvas SEMPRE devolve, mesmo que o turno já tivesse produzido
      // algo (tool/texto) antes de ser interrompido: foi parado no meio à força por
      // orçamento, não terminou por conta própria — o usuário não decidiu descartar
      // o que sobrou. Sem tentativa contada (ver requeueParked).
      if (parked && thread.budgetStopped) {
        requeueParked(thread.parkedFrom ?? sessionKey, parked, false);
      } else if (parked && (!produced || authBurned || burnedByQuota({ limited: hold > 0, tools: thread.tools.length, text: thread.text }))) {
        requeueParked(thread.parkedFrom ?? sessionKey, parked);
      }
      // Turno que morreu no meio sem dizer nada: avisa ANTES do 'done' (a bolha de
      // erro entra acima do rodapé de conclusão) e retoma sozinho logo abaixo. Um
      // fechamento saudável zera o contador pra a próxima falha ter direito a
      // retomada — senão um incidente antigo consumiria a cota da sessão pra sempre.
      const silent = isSilentDeath(thread);
      let cause: DeathCause = 'crash';
      if (silent) {
        // D1 — classifica ANTES de avisar: exit 143/137 (ou sinal) com a máquina
        // realmente apertada de memória no instante do fechamento é earlyoom/OOM
        // killer, não um crash genérico. O usuário vê a causa real em vez de
        // "processo morreu sem resposta" seguido de retomada imediata fadada a
        // morrer de novo (era o resume-exhausted em 5-10s do postmortem).
        const memInfo = readMemInfo();
        cause = classifyDeath({
          exitCode: thread.lastExitCode, signal: thread.lastExitSignal,
          userStopped: thread.userStopped, reaped: !!thread.reaped, info: memInfo,
        });
        if (cause === 'oom') {
          broadcast({ t: 'error', sessionKey, message: 'A máquina ficou sem memória e o sistema matou este turno. Vou retomar quando a memória voltar.' });
          recordIncident({ kind: 'oom-kill', sessionKey, sessionId: thread.sessionId, detail: `availMb=${memInfo.availMb} swapFreeMb=${memInfo.swapFreeMb} swapTotalMb=${memInfo.swapTotalMb}` });
        } else if (cause === 'external-signal') {
          // Marca a rajada ANTES de qualquer espera: os irmãos que morrerem na
          // mesma leva empurram a janela de silêncio uns dos outros.
          noteExternalKill();
          broadcast({ t: 'error', sessionKey, message: 'Algo fora do Deck matou este turno (deploy ou o sistema). Vou retomar assim que a máquina assentar.' });
          recordIncident({ kind: 'external-kill', sessionKey, sessionId: thread.sessionId, detail: `exit=${thread.lastExitCode ?? '?'} signal=${thread.lastExitSignal ?? '-'} availMb=${memInfo.availMb}` });
        } else {
          broadcast({ t: 'error', sessionKey, message: 'O turno caiu antes de terminar (o processo morreu sem resposta).' });
          recordIncident({ kind: 'silent-death', sessionKey, sessionId: thread.sessionId, detail: `${Math.round((Date.now() - thread.startedAt) / 1000)}s vivo, ${thread.tools.length} tools, ${thread.text.length} chars de resposta` });
        }
      }
      else if (!thread.reaped) autoResumes.delete(sessionKey);
      // O turno que acabou de fechar é EXATAMENTE o que moveu a barra de uso.
      // Sem este gatilho o número só chegava no próximo poll (ou num F5).
      notePlanUsageChanged();
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
      emitTurnClosed({
        sessionKey, sessionId: thread.sessionId, prompt: thread.prompt, text: thread.text, params: thread.params,
        ok: isCleanTurnClose(thread, { silent, authBurned, quotaBurned: burnedByQuota({ limited: hold > 0, tools: thread.tools.length, text: thread.text }) }),
        hop: thread.flowHop ?? 0, unattended,
      });
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
        if (hold || authBurned) parkPending(sessionKey, thread.sessionId);
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
      if (silent || (thread.reaped && thread.reaped !== 'total')) {
        // Sem token não adianta retomar nada (o turno novo morreria no limite
        // igual), mas o turno também não pode sumir: vira oferta com o motivo.
        if (hold) offerResume(sessionKey, thread, 'quota', 'O turno caiu e a janela de token acabou — retomar agora morreria no limite. Retome quando a janela virar.');
        else maybeAutoResume(sessionKey, thread, cause);
      }
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
  // The key the "prompt grande demais" check reports its error under, when
  // it differs from the routing `sessionKey` (dispatch.ts's 'send' case
  // resolved a canvas send onto a DIFFERENT live thread via
  // resolveThreadKey). Defaults to `sessionKey`. Only matters for THIS one
  // check: it fires BEFORE any 'triage' broadcast, which is what the
  // client's own aliasRoutedKey correlation (useCockpit.ts) needs to have
  // seen first — every later rejection in this function already happens
  // after 'triage' and is covered by that mechanism instead.
  displayKey?: string;
}

export async function routeSend(o: RouteSendOptions) {
  const { ws, sessionKey, prompt, resumeId, msgId, displayKey = sessionKey } = o;
  const params = runParams(o);
  if (typeof sessionKey !== 'string' || !SESSION_KEY_RE.test(sessionKey)) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
  if (typeof prompt !== 'string' || Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) { send(ws, { t: 'error', sessionKey: displayKey, message: 'prompt grande demais' }); return; }
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
  // Mesmo gate de admissão do drainParked. Um cron não carrega resumeId (cada
  // disparo é turno novo), então a sessão desta chamada em si nunca é
  // classificável de antemão — a chave estável `cron-<id>` é o segundo sinal
  // que isAreaAdmissionBlocked aceita: a área da ÚLTIMA sessão real que este
  // MESMO cron produziu (canvas/autopause-loop.ts's lastAreaOfKey), que fica
  // valendo até o cron rodar de novo e (talvez) mudar de área.
  const cronKey = `cron-${cron.id}`;
  if (isAreaAdmissionBlocked(undefined, cronKey)) return;
  startRun({
    ws: null,
    sessionKey: cronKey,
    prompt: cron.prompt,
    msgId: `cron-${Date.now().toString(36)}`,
    mode: cron.mode,
    model: cron.model,
    effort: cron.effort || 'low',
  });
}
