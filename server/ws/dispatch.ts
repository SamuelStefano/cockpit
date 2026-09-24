import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import type { Role } from '../auth';
import { listSessions, listArchived } from '../sessions/index';
import { searchSessions } from '../sessions/search';
import { listContexts, readContext, installContext } from '../contexts';
import { handoffSession } from '../handoff';
import { funnelSessions } from '../funnel';
import { getNotes, saveNotes } from '../notes';
import { putDrop, listDrops, openDrop, removeDrop } from '../drop';
import { readPoints, createEntry, correctPoints, noteEntry, deleteEntry } from '../points';
import { readDflSnapshot } from '../dfl-points';
import { readDrafts, mutateDrafts } from '../dfl-drafts';
import { isDraftOp } from '../../shared/dfl-drafts';
import { registerFinanceClient, emitFinanceMsg } from './finance-clients';
import { runDflSync } from '../dfl-sync-runner';
import { runDflWrite } from '../dfl-write-runner';
import { buildAgentTasksPrompt, agentSessionKey, MAX_NOTE_BYTES } from '../pontos-agent';
import { buildStageDraftsPrompt } from '../pontos-stage-prompt';
import { getCrons, saveCron, deleteCron, runCronNow } from '../crons';
import { scheduleValid } from '../../shared/cron-schedule';
import { fireCron } from './runs';
import { listSkills, readSkill, resolveSkillDeny, installSkill } from '../skills';
import { getRegistryCatalog, installFromRegistry } from '../skill-registry-runner';
import { addUploadChunk, readAttachment } from '../attachments';
import { usageStats, lastUsageOf } from '../db';
import { hideSession, unhideSession, purgeSession, setTitle, setNote } from '../store';
import { parseSession, parseFullSession } from '../sessions/parse';
import { collectHealth } from '../health';
import { setEnv, unsetEnv, addMcp, removeMcp, installCli, envNameAllowedRemotely } from '../admin-ops';
import { updateClaudeCli, restartDeck } from '../deck-ops';
import { CONFIG } from '../config';
import { send, broadcast } from './broadcast';
import { detach } from './detach';
import { startRun, routeSend, drainParked, runParkedInBackground, runParkedNow, acceptResumeOffer, refreshBusyElsewhere, orchestratorPaneTarget, type BgRunReject, type NowRunReject } from './runs';
import { threads, stopSession, resolveThreadKey, runningSessionIds } from './threads';
import { clearAwaiting } from './awaiting';
import { addParked, removeParked, editParked, moveParked, clearParked, retryParked, parkedView, isQueuePaused, setQueuePaused, REJECT_MESSAGE } from './parked';
import { refreshModels } from './models';
import { handleHarnessMsg } from './harness';
import { setMarathon, marathonKeys } from './marathon';
import { sendDurableSnapshot } from './snapshot';
import { requestPlanUsageRefresh, planUsageFrame } from './usage-plan';
import { listGraphs, readGraph, buildGraph, deleteGraph, queryGraph, nodeOp } from '../graph';
import { buildBench } from '../bench';
import { buildCanvas } from '../canvas/index';
import { readOrchestrator } from '../canvas/orchestrator';
import { readOrchestratorActivity } from '../canvas/orchestrator-activity';
import { readBusyElsewhereSessionIds, refreshLivenessSnapshot } from '../canvas/cv-liveness';
import { peekSession } from '../sessions/peek';
import { collectCtxOnly, collectTermStats, hasInteractiveClaude, newCpuSamples, type CpuSamples } from '../canvas/term-stats';
import {
  MAX_FLOWS, MAX_BULK_STATUS_IDS, readBoard, readBoardChained, updateBoard, sanitizeCard, sanitizeFlow, sanitizePos, sanitizeSessionIds,
  upsertCard, upsertFlow, removeCard, removeFlow, checkFlowSave, mergePos, setBudget, sanitizeSessionStatus, setSessionStatus,
  setSessionStatusMany, hideSessionOnBoard, unhideAllSessionsOnBoard, setCardDflLink, clearCardDflLink,
} from '../canvas/board';
import { activeFlowRuns } from '../canvas/flow-runs';
import { startCanvasFlows } from '../canvas/flows';
import { registerCanvasClient, emitCanvasMsg } from './canvas-clients';
import { CARD_STATUSES, type CanvasBoard, type CardStatus } from '../../shared/canvas';
import { updateAreaCacheFromGraph, getAreaOf } from '../canvas/autopause-loop';
import { areaUsageFromIds } from '../../shared/canvas-budget';
import { cardLinksAreUnanimouslyDfl, findDeliveryInSnapshot, findTaskInSnapshot } from '../canvas/dfl-link';
import { cancelPendingPush, pushCardDflStatus } from '../canvas/dfl-status-sync';
import { bindForkSession } from '../canvas/fork-sessions';

// Registers the turn-closed listener once, at module load — both entry points
// (server/index.ts, server/agent.ts) reach this file via ws/serve-connection.ts.
startCanvasFlows();

// Every canvas-board answer folds in whatever card-target flow runs are live
// right now (server/canvas/flow-runs.ts) — a tab that (re)connects mid-run
// (F5, a second tab, /canvas opened after the flow already fired) needs this
// on the SAME frame as the board, not just the one-shot canvas-flow-run
// broadcast it may have missed entirely.
const boardFrame = (board: CanvasBoard) => ({ t: 'canvas-board' as const, board, flowRuns: activeFlowRuns() });

// CPU samples for the canvas-term-stats POLL, keyed per SOCKET — not one
// shared map. cpuPercent is a delta against the previous sample per key
// (server/canvas/term-stats.ts); a map shared across every tab/connection let
// one browser tab's 3s poll zero out another tab's delta whenever they landed
// close together (review #595 point 5 — the same class of bug already fixed
// once between the client poll and the autopause loop, just one layer finer).
// WeakMap: a closed socket's samples are dropped for free, no cleanup needed.
const dispatchTermSamplesBySocket = new WeakMap<WebSocket, CpuSamples>();
function termSamplesFor(ws: WebSocket): CpuSamples {
  let m = dispatchTermSamplesBySocket.get(ws);
  if (!m) { m = newCpuSamples(); dispatchTermSamplesBySocket.set(ws, m); }
  return m;
}

const BG_RUN_MESSAGE: Record<BgRunReject, string> = {
  'sem-item': 'este item não está mais na fila',
  'sem-contexto': 'esta sessão ainda não tem contexto pra forkar',
  'sem-quota': 'sem tokens agora: o turno morreria no limite',
  'sem-slot': 'limite de sessões simultâneas atingido',
  'falhou': 'não deu pra abrir o chat paralelo — o item voltou pra fila',
  'ctx-grande': 'essa sessão já está grande demais pra herdar — abra uma sessão nova em vez de fork',
};
// Mesmo dicionário, exceto 'falhou': um fork de card NUNCA deixa o item pra
// trás na fila do pai (review #597 point 1 — removeParked roda em toda
// recusa), então "voltou pra fila" mentiria aqui.
const CANVAS_FORK_MESSAGE: Record<BgRunReject, string> = {
  ...BG_RUN_MESSAGE,
  'falhou': 'não deu pra abrir o chat paralelo — tente de novo',
};

const NOW_RUN_MESSAGE: Record<NowRunReject, string> = {
  'sem-item': 'este item não está mais na fila',
  'segurado': 'este item está segurado no teto de tentativas: retome a fila primeiro',
  'fila-pausada': 'a fila está pausada: retome antes de furar a fila',
  'sem-quota': 'sem tokens agora: o turno morreria no limite',
  'aguardando-resposta': 'o turno está esperando sua resposta: responda o card ou use forçar a fila',
  'falhou': 'não deu pra subir o item agora — ele voltou pra fila',
};

// Cards with a dfl-task-create-link between its checks and its board write.
const dflCreatesInFlight = new Set<string>();

export async function handle(ws: WebSocket, msg: ClientMsg, role?: Role) {
  switch (msg.t) {
    case 'ping': {
      // Ecoa o pong pro MESMO socket. Barato de propósito: o cliente usa o
      // ida-e-volta pra detectar socket meio-aberto e reconectar sem F5.
      send(ws, { t: 'pong' });
      return;
    }
    case 'graph-list': {
      send(ws, { t: 'graphs', items: await listGraphs() });
      return;
    }
    case 'graph-open': {
      const graph = await readGraph(msg.id);
      if (!graph) { send(ws, { t: 'error', message: 'grafo não encontrado' }); return; }
      send(ws, { t: 'graph-data', id: msg.id, graph });
      return;
    }
    case 'graph-query': {
      const res = await queryGraph(msg.id, msg.question, msg.budget);
      if (!res) { send(ws, { t: 'error', message: 'grafo não encontrado' }); return; }
      send(ws, { t: 'graph-query-result', id: msg.id, question: msg.question, answer: res.answer, tokens: res.tokens, miss: res.miss });
      return;
    }
    case 'graph-node-op': {
      const res = await nodeOp(msg.id, msg.op, msg.a, msg.b);
      if (!res) { send(ws, { t: 'error', message: 'operação inválida no grafo' }); return; }
      const label = msg.op === 'explain' ? `explicar ${msg.a}` : msg.op === 'affected' ? `impacto de ${msg.a}` : `caminho ${msg.a} → ${msg.b}`;
      send(ws, { t: 'graph-query-result', id: msg.id, question: label, answer: res.answer, tokens: res.tokens, miss: res.miss });
      return;
    }
    case 'graph-build': {
      // Progresso em streaming: o graphify loga o avanço da extração no stdout; cada
      // linha vira um frame p/ a UI mostrar o build vivo. build é longo (spawn AST).
      const result = await buildGraph(msg.repo, (line) => send(ws, { t: 'graph-build-progress', line }));
      send(ws, { t: 'graph-build-done', ok: result.ok, id: result.id, error: result.error });
      if (result.ok && result.id) {
        send(ws, { t: 'graphs', items: await listGraphs() });
        const graph = await readGraph(result.id);
        if (graph) send(ws, { t: 'graph-data', id: result.id, graph });
      }
      return;
    }
    case 'graph-delete': {
      const ok = await deleteGraph(msg.id);
      if (!ok) { send(ws, { t: 'error', message: 'não foi possível excluir o grafo' }); return; }
      send(ws, { t: 'graphs', items: await listGraphs() });
      return;
    }
    case 'canvas-term-stats': {
      const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
      const sessions = ids(msg.sessions);
      const terms = ids(msg.terms);
      const runs = [...threads].map(([key, t]) => ({ key, sessionId: t.sessionId, pid: t.handle.pid, startedAt: t.startedAt }));
      const runningIds = [...new Set(runs.map((r) => r.sessionId).filter((s): s is string => !!s))];
      // Stats cover this caller's own open ids (for the per-terminal bars) UNION
      // every running session (for area usage below) — the union avoids a
      // second collectTermStats pass for ids already in the caller's own set.
      const statIds = [...new Set([...sessions, ...runningIds])];
      const stats = await collectTermStats(statIds, terms, runs, termSamplesFor(ws));
      const requested: Record<string, typeof stats[string]> = {};
      for (const id of [...sessions, ...terms]) if (stats[id]) requested[id] = stats[id];
      send(ws, { t: 'canvas-term-stats', stats: requested });
      // Single source of truth (review #595 point 4): area usage is summed over
      // EVERY running session (claude tree + tmux pane CPU, ctx tokens) — the
      // exact same set autopause-loop.ts enforces against — never just this
      // caller's own open windows. Display and enforcement can no longer
      // disagree because they're now the same function over the same ids.
      const usage = areaUsageFromIds(getAreaOf(), runningIds, stats);
      send(ws, { t: 'canvas-area-usage', usage });
      return;
    }
    // CardEditor's reuse-pool lookup (session-reuse.ts) — deliberately NOT
    // 'canvas-term-stats': collectCtxOnly never touches the per-socket CPU
    // sample store or joins running-session ids into an area-usage
    // computation (review #597 follow-up point 2 — see the ClientMsg comment).
    case 'canvas-ctx-stats': {
      const sessions = Array.isArray(msg.sessions) ? msg.sessions.filter((x): x is string => typeof x === 'string') : [];
      const stats = await collectCtxOnly(sessions);
      send(ws, { t: 'canvas-ctx-stats', stats });
      return;
    }
    case 'canvas-session-peek': {
      const sessionId = typeof msg.sessionId === 'string' ? msg.sessionId : '';
      send(ws, { t: 'canvas-session-peek', sessionId, peek: await peekSession(sessionId) });
      return;
    }
    case 'canvas-get': {
      // 'canvas-get' is already admin-only at authz.ts (not in
      // STUDENT_ALLOWED) — registering here is enough for
      // server/ws/canvas-clients.ts's admin-only push (canvas-flow-failed).
      registerCanvasClient(ws);
      // Chained, not a plain readBoard(): otherwise this can race a concurrent
      // drag-end/card-save write and answer with a stale board (review #7).
      const board = await readBoardChained();
      send(ws, boardFrame(board));
      const graph = await buildCanvas(board, runningSessionIds());
      // Cheapest refresh point for the autopause loop's session->area cache
      // (canvas/autopause-loop.ts): reuses this exact graph, no extra build.
      updateAreaCacheFromGraph(graph);
      send(ws, { t: 'canvas-graph', graph });
      // Fresh, not the cached getters: startCvLivenessLoop only refreshes its
      // cache while a client is connected, and a deckctl round trip (a few
      // seconds) can come and go between ticks (5s) without ever refreshing
      // it — a client that just asked deserves data at least as fresh as its
      // own request, not whatever the loop last happened to see.
      const liveness = await refreshLivenessSnapshot();
      send(ws, { t: 'cv-live', sessionIds: liveness.live, idleSessionIds: liveness.idle });
      return;
    }
    case 'orchestrator-get': {
      send(ws, { t: 'orchestrator-info', info: await readOrchestrator() });
      return;
    }
    // Admin-only (not in authz.ts's STUDENT_ALLOWED): the dock's panel is a
    // Samuel-only surface, and unlike 'orchestrator-get' this touches tmux
    // session names and delegated-shell file contents.
    case 'orchestrator-activity-get': {
      const info = await readOrchestrator();
      send(ws, { t: 'orchestrator-activity', activity: info ? await readOrchestratorActivity(info) : { subagents: [], delegatedShells: [], rawShells: [] } });
      return;
    }
    case 'canvas-pos': {
      const pos = sanitizePos(msg.pos);
      if (Object.keys(pos).length) await updateBoard((b) => mergePos(b, pos));
      return;
    }
    // Canvas frames answer the caller only: broadcast() fans out regardless of
    // role, and the graph carries every memory title and session summary.
    case 'canvas-pos-reset': {
      const board = await updateBoard((b) => ({ ...b, pos: {} }));
      send(ws, boardFrame(board));
      return;
    }
    // The kanban's session items (src/routes/canvas/kanban-items.ts): the
    // user dragged a session into a column (or hit "marcar completo"), which
    // is always a full override — a client re-sends the whole {status, at}
    // it wants, never a partial patch.
    case 'canvas-session-status': {
      const now = Date.now();
      // No `at` in the raw payload: it's ALWAYS server time for a live write
      // (sanitizeSessionStatus defaults to `now` when unset) — only readBoard
      // parsing a value already on disk supplies one, to keep the original
      // decision time across a restart.
      const clean = sanitizeSessionStatus(String(msg.sessionId ?? ''), { status: msg.status }, now);
      if (!clean) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      const board = await updateBoard((b) => setSessionStatus(b, clean.sessionId, clean.entry));
      send(ws, boardFrame(board));
      // A second tab/phone must see the move without waiting on the next
      // sessions-triggered refresh (canvas review item 12a) — slim patch, not
      // the whole board, same ADMIN-ONLY channel canvas-card-status already
      // uses.
      emitCanvasMsg({ t: 'canvas-session-status', sessionId: clean.sessionId, status: clean.entry.status, at: clean.entry.at });
      return;
    }
    // Done column bulk triage ("completar antigos (N)", canvas review item
    // 2): every selected id gets the SAME override, applied inside ONE
    // updateBoard call (setSessionStatusMany) — one disk write for the whole
    // batch, not one per session.
    case 'canvas-session-status-bulk': {
      const now = Date.now();
      const status = CARD_STATUSES.includes(msg.status as CardStatus) ? (msg.status as CardStatus) : undefined;
      const sessionIds = sanitizeSessionIds(msg.sessionIds, MAX_BULK_STATUS_IDS);
      if (!status || !sessionIds.length) { send(ws, { t: 'error', message: 'seleção inválida' }); return; }
      const entry = { status, at: now };
      const board = await updateBoard((b) => setSessionStatusMany(b, sessionIds, entry));
      send(ws, boardFrame(board));
      emitCanvasMsg({ t: 'canvas-session-status-bulk', sessionIds, status, at: now });
      return;
    }
    // Kanban drawer "ocultar" — board-persisted (canvas review item 2), so it
    // holds across devices instead of the old per-device localStorage list.
    case 'canvas-session-hide': {
      const board = await updateBoard((b) => hideSessionOnBoard(b, String(msg.sessionId ?? '')));
      send(ws, boardFrame(board));
      return;
    }
    case 'canvas-session-unhide-all': {
      const board = await updateBoard((b) => unhideAllSessionsOnBoard(b));
      send(ws, boardFrame(board));
      return;
    }
    case 'canvas-card-save': {
      // Same rule as canvas-flow-save: prev comes from the snapshot the write
      // lands on. sanitizeCard copies the server-owned `dfl` field from prev, so a
      // separate readBoard() let a concurrent pushCardDflStatus or dfl-task-unlink
      // be rolled back — an unlinked card came back linked and wrote to DFL again.
      const now = Date.now();
      const saved: { prev?: NonNullable<ReturnType<typeof sanitizeCard>>; card: ReturnType<typeof sanitizeCard> } = { card: null };
      const board = await updateBoard((b) => {
        saved.prev = b.cards.find((c) => c.id === msg.card?.id);
        saved.card = sanitizeCard(msg.card, saved.prev, now);
        return saved.card ? upsertCard(b, saved.card) : b;
      });
      const { prev, card } = saved;
      if (!card) { send(ws, { t: 'error', message: 'card inválido' }); return; }
      send(ws, boardFrame(board));
      send(ws, { t: 'canvas-graph', graph: await buildCanvas(board, runningSessionIds()) });
      // A manual save (drag, editor) used to reach a second tab/phone only on
      // the next sessions-triggered refresh — same gap as canvas-session-status
      // above (canvas review item 12a). Reuses the slim canvas-card-status
      // patch card-review.ts's own auto-move already broadcasts.
      if (prev?.status !== card.status) emitCanvasMsg({ t: 'canvas-card-status', cardId: card.id, status: card.status });
      // Deck -> DFL: a user-driven status change (drag, editor save, "marcar
      // completo") on an already-linked card pushes the new status to its DFL
      // task. Fire-and-forget — pushCardDflStatus owns its own retry/backoff
      // and never throws; it must not hold up this frame's reply.
      if (card.dfl && prev?.status !== card.status) void pushCardDflStatus(card.id, card.status, card.dfl.taskId);
      return;
    }
    // Opt-in link to an EXISTING DFL task. Server-side guards, none trusted
    // from the client: (1) `confirm: true` must be present — the UI shows
    // exactly what's being linked before sending this; (2) the card's area,
    // recomputed from the graph THIS build, must be 'dfl' for EVERY linked
    // context/session (cardLinksAreUnanimouslyDfl — a majority vote would let
    // a mixed personal+DFL card through, see server/canvas/dfl-link.ts);
    // (3) taskId must already be in the owner-filtered snapshot
    // (server/dfl-sync.ts) — never a live lookup. No DFL write happens here
    // at all (linking itself is local-only); dflUpdatedAt is stamped from the
    // task's own updated_at so the FIRST conflict check has a real baseline.
    case 'dfl-task-link': {
      if (msg.confirm !== true) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'confirmação obrigatória' }); return; }
      const cardId = String(msg.cardId ?? '');
      const taskId = String(msg.taskId ?? '');
      const board0 = await readBoard();
      if (!board0.cards.some((c) => c.id === cardId)) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'card inválido' }); return; }
      const graph = await buildCanvas(board0, runningSessionIds());
      if (!cardLinksAreUnanimouslyDfl(graph, cardId)) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'card tem contexto/sessão fora da área DFL' }); return; }
      const snapshot = await readDflSnapshot();
      const task = snapshot && findTaskInSnapshot(snapshot, taskId);
      if (!task) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'task não encontrada no snapshot DFL' }); return; }
      const board = await updateBoard((b) => setCardDflLink(b, cardId, taskId, Date.now(), task.updatedAt));
      send(ws, boardFrame(board));
      send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: true });
      return;
    }
    // Creates a task under an existing (epicId, deliveryId) pair via the
    // sanctioned write channel (server/dfl-write.ts's task-create, PostgREST
    // on work.tasks — same schema the read side already fetches, never the
    // financial workflow points-change/invoice-create use), THEN links it —
    // one user action, one write. Same confirm + unanimous-area guard as
    // dfl-task-link. `why`/`what` come from the CLIENT'S explicit text
    // fields (CardEditor's confirm step), NEVER the card's raw `prompt` —
    // the agent instructions on a card can carry personal content that has
    // no business reaching a DFL-visible task description. The
    // (epicId, deliveryId) pair is re-derived from the snapshot as a PAIR
    // (findDeliveryInSnapshot), not each id trusted independently.
    case 'dfl-task-create-link': {
      if (!CONFIG.localOnly) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'escrita DFL só no loopback' }); return; }
      if (msg.confirm !== true) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'confirmação obrigatória' }); return; }
      const cardId = String(msg.cardId ?? '');
      const board0 = await readBoard();
      const cardBefore = board0.cards.find((c) => c.id === cardId);
      if (!cardBefore) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'card inválido' }); return; }
      // Creating is not idempotent in DFL: a second confirm (stale editor, two
      // tabs, double click) would create a duplicate task in prod.
      if (cardBefore.dfl) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'card já vinculado a uma task DFL' }); return; }
      if (dflCreatesInFlight.has(cardId)) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'criação já em andamento pra este card' }); return; }
      dflCreatesInFlight.add(cardId);
      try {
        const graph = await buildCanvas(board0, runningSessionIds());
        if (!cardLinksAreUnanimouslyDfl(graph, cardId)) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'card tem contexto/sessão fora da área DFL' }); return; }
        const snapshot = await readDflSnapshot();
        const delivery = snapshot && findDeliveryInSnapshot(snapshot, String(msg.epicId ?? ''), String(msg.deliveryId ?? ''));
        if (!delivery) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'epic/delivery não encontrados no snapshot DFL' }); return; }
        const r = await runDflWrite({
          kind: 'task-create', epicId: String(msg.epicId), deliveryId: String(msg.deliveryId),
          taskName: String(msg.taskName ?? cardBefore.title).slice(0, 200), why: String(msg.why ?? ''), what: String(msg.what ?? ''),
        });
        if (!r.ok) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: r.error }); return; }
        const taskId = String(r.result.taskId ?? '');
        const board = await updateBoard((b) => setCardDflLink(b, cardId, taskId, Date.now(), Date.now()));
        send(ws, boardFrame(board));
        send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: true, taskId });
        runDflSync().catch(() => {});
        return;
      } finally {
        dflCreatesInFlight.delete(cardId);
      }
    }
    // Always local-only, unconditionally allowed (no area/loopback gate): it
    // never talks to DFL and never deletes the task there — see
    // server/dfl-write.ts, there is no DELETE path on purpose. Cancels
    // whatever push was still queued/retrying for this card FIRST — a push
    // whose board write landed after the link was cleared would otherwise
    // resurrect the just-dropped dfl field (setCardDflPending/Synced are
    // no-ops without one, so the actual risk is small, but a stale retry
    // still has no reason to keep running once nobody cares).
    case 'dfl-task-unlink': {
      const cardId = String(msg.cardId ?? '');
      cancelPendingPush(cardId);
      const board = await updateBoard((b) => clearCardDflLink(b, cardId));
      send(ws, boardFrame(board));
      return;
    }
    // The ONLY path that pushes review/done for real (statusNeedsHumanConfirm)
    // — a human clicked "confirmar sync" on a card sitting in
    // dfl.awaitingConfirm. Same loopback gate as every DFL write. The reply
    // means "confirmed and queued", not "already synced" — pushCardDflStatus
    // can retry for several minutes; awaiting it here would hold this frame's
    // reply hostage to that. The board's dfl.pending/error (+ a toast on
    // final failure) is how the UI actually learns the outcome.
    case 'dfl-task-confirm-sync': {
      if (!CONFIG.localOnly) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'escrita DFL só no loopback' }); return; }
      const cardId = String(msg.cardId ?? '');
      const card = (await readBoard()).cards.find((c) => c.id === cardId);
      if (!card?.dfl) { send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: false, message: 'card não vinculado' }); return; }
      void pushCardDflStatus(cardId, card.status, card.dfl.taskId, { confirmed: true });
      send(ws, { t: 'dfl-task-write', reqId: msg.reqId, ok: true });
      return;
    }
    case 'canvas-card-delete': {
      const board = await updateBoard((b) => removeCard(b, String(msg.id ?? '')));
      send(ws, boardFrame(board));
      send(ws, { t: 'canvas-graph', graph: await buildCanvas(board, runningSessionIds()) });
      return;
    }
    case 'canvas-flow-save': {
      // prev MUST come from inside the same updateBoard snapshot the write
      // lands on, not a separate readBoard() before the chain — otherwise a
      // concurrent claimFlowFire (a flow firing) landing in between would
      // hand sanitizeFlow a stale fires/lastFiredAt and the save would
      // silently roll it back (canvas review — flows batch #9/#10).
      const now = Date.now();
      let error: string | null = null;
      const board = await updateBoard((b) => {
        const prev = b.flows.find((f) => f.id === msg.flow?.id);
        const flow = sanitizeFlow(msg.flow, prev, now);
        if (!flow) { error = 'fluxo inválido'; return b; }
        const saveError = checkFlowSave(b, flow);
        if (saveError) { error = saveError === 'duplicado' ? 'já existe um fluxo entre esses dois nós' : `limite de ${MAX_FLOWS} fluxos atingido`; return b; }
        return upsertFlow(b, flow);
      });
      if (error) { send(ws, { t: 'error', message: error }); return; }
      send(ws, boardFrame(board));
      return;
    }
    case 'canvas-flow-delete': {
      const board = await updateBoard((b) => removeFlow(b, String(msg.id ?? '')));
      send(ws, boardFrame(board));
      return;
    }
    case 'canvas-budget-save': {
      const board = await updateBoard((b) => setBudget(b, String(msg.area ?? ''), msg.budget));
      send(ws, boardFrame(board));
      return;
    }
    case 'bench-build': {
      const res = await buildBench(msg.repo, msg.code);
      if (!res.ok) { send(ws, { t: 'bench-error', buildId: msg.buildId, error: res.error ?? 'falha no build' }); return; }
      send(ws, { t: 'bench-bundle', buildId: msg.buildId, js: res.js ?? '', css: res.css ?? '', ms: res.ms ?? 0 });
      return;
    }
    case 'list': {
      const items = await listSessions();
      send(ws, { t: 'sessions', items });
      return;
    }
    case 'sync': {
      // Resume no mobile (aba suspensa/rede voltou): reemite o estado durável fresco
      // pro socket que pediu, sem depender de eventos perdidos na suspensão.
      send(ws, { t: 'sessions', items: await listSessions() });
      sendDurableSnapshot(ws);
      return;
    }
    case 'plan-usage-get': {
      // Abrir o painel de uso: repinta o último número na hora e pede um fresco.
      // `force` = clique do usuário: passa por cima do espaçamento; só o 429 e o
      // orçamento da hora seguram, e ambos voltam no frame como `nextReadAt`.
      send(ws, planUsageFrame(Date.now(), true)!);
      requestPlanUsageRefresh({ mode: msg.force ? 'force' : 'active' });
      return;
    }
    case 'open': {
      const parsed = await parseSession(msg.sessionId);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      // Variante do modelo da última amostra: é o que diz se o medidor desta
      // sessão vale sobre 200k ou sobre 1M. O JSONL não carrega a marca `[1m]`.
      const model = lastUsageOf(msg.sessionId)?.requestedModel ?? undefined;
      // Pós-/compact o CLI ramifica de um summary e o histórico anterior sai do
      // caminho parentUuid: a cadeia ativa encolhe pra dezenas de mensagens numa
      // sessão de milhares — é o "o chat mostra muito pouco". Quando a timeline
      // completa tem substancialmente mais, ela é a visão honesta. `chainOnly` =
      // o usuário pediu explicitamente o resumido, então não sobrepõe.
      // As duas visões são capadas no MESMO historyLimit, então quando a cadeia já
      // encheu mais da metade do cap o `>= 2x` abaixo é aritmeticamente inalcançável:
      // parsear o arquivo inteiro de novo só pra descartar custava 4,5s de 9,6s no
      // F5 da sessão de 438MB. Sem o atalho o cap alto (2000) desliga o benefício.
      if (parsed.truncated && !msg.chainOnly && parsed.messages.length * 2 <= CONFIG.historyLimit) {
        const full = await parseFullSession(msg.sessionId);
        if (full && full.messages.length >= parsed.messages.length * 2) {
          send(ws, { t: 'history', sessionId: msg.sessionId, messages: full.messages, tokens: full.tokens, model, full: true, truncated: full.truncated, todos: full.todos });
          return;
        }
      }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens, model, truncated: parsed.truncated, todos: parsed.todos });
      return;
    }
    case 'open-full': {
      const before = typeof msg.before === 'string' ? msg.before : undefined;
      const parsed = await parseFullSession(msg.sessionId, before);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens, model: lastUsageOf(msg.sessionId)?.requestedModel ?? undefined, full: true, prepend: !!before, truncated: parsed.truncated, todos: parsed.todos });
      return;
    }
    case 'hide': {
      await hideSession(msg.sessionId);
      send(ws, { t: 'sessions', items: await listSessions() });
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'unhide': {
      await unhideSession(msg.sessionId);
      send(ws, { t: 'sessions', items: await listSessions() });
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'list-archived': {
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'purge': {
      // "Excluir": some de tudo no cockpit (o .jsonl no disco fica intacto).
      await purgeSession(msg.sessionId);
      broadcast({ t: 'sessions', items: await listSessions() });
      broadcast({ t: 'archived', items: await listArchived() });
      return;
    }
    case 'set-meta': {
      // Override manual de título/descrição (texto vazio limpa). Re-broadcast da
      // lista p/ todos os clientes verem o novo rótulo na hora.
      if (typeof msg.title === 'string') await setTitle(msg.sessionId, msg.title);
      if (typeof msg.summary === 'string') await setNote(msg.sessionId, msg.summary);
      broadcast({ t: 'sessions', items: await listSessions() });
      return;
    }
    case 'set-marathon': {
      setMarathon(msg.sessionKey, !!msg.on);
      broadcast({ t: 'marathon', keys: marathonKeys() });
      return;
    }
    case 'search': {
      // msg vem de JSON.parse cru: q não-string faria searchSessions().trim() lançar.
      const q = typeof msg.q === 'string' ? msg.q : '';
      send(ws, { t: 'search-results', q, items: await searchSessions(q) });
      return;
    }
    case 'ctx-list': {
      send(ws, { t: 'contexts', items: await listContexts() });
      return;
    }
    case 'ctx-open': {
      const c = await readContext(msg.id);
      // A missing id used to get no reply at all, and the UI waited forever.
      if (c) send(ws, { t: 'context', id: msg.id, title: c.title, body: c.body });
      else send(ws, { t: 'error', message: 'contexto não encontrado' });
      return;
    }
    case 'session-handoff': {
      const r = await handoffSession(msg.sessionId);
      if ('error' in r) { send(ws, { t: 'handoff-result', sessionId: msg.sessionId, ok: false, error: r.error }); return; }
      send(ws, { t: 'handoff-result', sessionId: msg.sessionId, ok: true, contextId: r.contextId, fromTitle: r.fromTitle });
      send(ws, { t: 'contexts', items: await listContexts() });
      broadcast({ t: 'sessions', items: await listSessions() });
      broadcast({ t: 'archived', items: await listArchived() });
      return;
    }
    case 'sessions-funnel': {
      const ids = Array.isArray(msg.sessionIds) ? msg.sessionIds : [];
      const r = await funnelSessions(ids);
      if ('error' in r) { send(ws, { t: 'funnel-result', ok: false, error: r.error }); return; }
      send(ws, { t: 'funnel-result', ok: true, contextId: r.contextId, archived: r.archived, empty: r.empty });
      send(ws, { t: 'contexts', items: await listContexts() });
      broadcast({ t: 'sessions', items: await listSessions() });
      broadcast({ t: 'archived', items: await listArchived() });
      return;
    }
    case 'notes-get': {
      send(ws, { t: 'notes', text: await getNotes() });
      return;
    }
    case 'notes-save': {
      await saveNotes(msg.text);
      return;
    }
    // Drop privado (admin-only pelo authorize). A resposta do put é a REFERÊNCIA,
    // nunca o conteúdo: ecoar o segredo de volta o colocaria no estado do cliente
    // e o traria pro transcript pela porta dos fundos. Unicast (send), sem
    // broadcast — segredo não faz fan-out cego pros outros aparelhos.
    case 'drop-put': {
      const r = await putDrop(msg.slug, msg.content, msg.ttlMs);
      if ('error' in r) { send(ws, { t: 'error', message: r.error }); return; }
      send(ws, { t: 'drop', ref: r });
      send(ws, { t: 'drops', items: await listDrops() });
      return;
    }
    case 'drop-list': {
      send(ws, { t: 'drops', items: await listDrops() });
      return;
    }
    // Último recurso: só aqui o conteúdo volta, e só porque foi pedido de propósito.
    case 'drop-open': {
      const r = await openDrop(msg.slug);
      if ('error' in r) { send(ws, { t: 'error', message: r.error }); return; }
      send(ws, { t: 'drop', ref: r.ref, content: r.content });
      return;
    }
    case 'drop-rm': {
      const r = await removeDrop(msg.slug);
      if ('error' in r) { send(ws, { t: 'error', message: r.error }); return; }
      send(ws, { t: 'drops', items: await listDrops() });
      return;
    }
    case 'points-get': {
      const { entries, total } = await readPoints();
      send(ws, { t: 'points', entries, total });
      return;
    }
    // Escrita by:user. Após appendar o evento, re-fold e broadcast pra TODOS os
    // aparelhos (o agente appenda via CLI; todos atualizam ao vivo). Validação de
    // borda (frame cru): points finito 0..100000, strings presentes.
    case 'points-add': {
      if (typeof msg.title !== 'string' || !msg.title.trim() || typeof msg.points !== 'number' || !Number.isFinite(msg.points) || msg.points < 0 || msg.points > 100_000) {
        send(ws, { t: 'error', message: 'ponto inválido' });
        return;
      }
      await createEntry({ title: msg.title.trim(), points: msg.points, description: typeof msg.description === 'string' ? msg.description : undefined, by: 'user' });
      const p = await readPoints();
      broadcast({ t: 'points', entries: p.entries, total: p.total });
      return;
    }
    case 'points-correct': {
      if (typeof msg.entryId !== 'string' || typeof msg.points !== 'number' || !Number.isFinite(msg.points) || msg.points < 0 || msg.points > 100_000) {
        send(ws, { t: 'error', message: 'correção inválida' });
        return;
      }
      await correctPoints(msg.entryId, msg.points, 'user');
      const p = await readPoints();
      broadcast({ t: 'points', entries: p.entries, total: p.total });
      return;
    }
    case 'points-note': {
      if (typeof msg.entryId !== 'string' || typeof msg.description !== 'string') {
        send(ws, { t: 'error', message: 'nota inválida' });
        return;
      }
      await noteEntry(msg.entryId, msg.description, 'user');
      const p = await readPoints();
      broadcast({ t: 'points', entries: p.entries, total: p.total });
      return;
    }
    case 'points-delete': {
      if (typeof msg.entryId !== 'string') {
        send(ws, { t: 'error', message: 'id inválido' });
        return;
      }
      await deleteEntry(msg.entryId, 'user');
      const p = await readPoints();
      broadcast({ t: 'points', entries: p.entries, total: p.total });
      return;
    }
    // Snapshot financeiro DFL: UNICAST (send), nunca broadcast. Só chega aqui quem
    // passou pelo authorize (admin/root — points-dfl-* fora do STUDENT_ALLOWED).
    // Registra o socket p/ receber PUSH quando o cron reescrever o arquivo.
    case 'points-dfl-get': {
      registerFinanceClient(ws);
      send(ws, { t: 'points-dfl', snapshot: await readDflSnapshot() });
      return;
    }
    // sync-now: dispara o fetcher como processo filho (token fora deste processo);
    // o watcher empurra o resultado. Responde 'syncing' pra UI mostrar o estado.
    case 'points-dfl-sync': {
      registerFinanceClient(ws);
      send(ws, { t: 'points-dfl-syncing' });
      runDflSync().then((r) => { if (!r.ok) send(ws, { t: 'error', message: 'sync DFL falhou' }); }).catch(() => {});
      return;
    }
    // Escritas no DFL prod (mudar pontos / gerar fatura). Gate DURO: só no loopback
    // (box do dono) — o agente federado NUNCA escreve no financeiro do Samuel. Roda
    // num processo filho (token fora deste processo) e, no sucesso, dispara um resync
    // pra o snapshot refletir a mudança. Ação disparada por clique do usuário.
    case 'points-dfl-change': {
      if (!CONFIG.localOnly) { send(ws, { t: 'points-dfl-write', reqId: msg.reqId, kind: 'change', ok: false, message: 'escrita DFL só no loopback' }); return; }
      registerFinanceClient(ws);
      const r = await runDflWrite({ kind: 'points-change', taskId: msg.taskId, taskName: msg.taskName, currentPoints: msg.currentPoints, newPoints: msg.newPoints, reason: msg.reason });
      send(ws, { t: 'points-dfl-write', reqId: msg.reqId, kind: 'change', ok: r.ok, message: r.ok ? undefined : r.error });
      if (r.ok) runDflSync().catch(() => {});
      return;
    }
    case 'points-dfl-invoice': {
      if (!CONFIG.localOnly) { send(ws, { t: 'points-dfl-write', reqId: msg.reqId, kind: 'invoice', ok: false, message: 'escrita DFL só no loopback' }); return; }
      registerFinanceClient(ws);
      const r = await runDflWrite({ kind: 'invoice-create', deliveryId: msg.deliveryId, deliveryName: msg.deliveryName, projectId: msg.projectId, projectName: msg.projectName, referenceMonth: msg.referenceMonth, pricePerPoint: msg.pricePerPoint, tasks: msg.tasks });
      send(ws, { t: 'points-dfl-write', reqId: msg.reqId, kind: 'invoice', ok: r.ok, message: r.ok ? undefined : r.error });
      if (r.ok) runDflSync().catch(() => {});
      return;
    }
    // Botão "criar tasks com agente": não escreve no DFL daqui — abre um turno
    // autônomo (mesmo caminho do cron) com o prompt que carrega as duas regras de
    // teto. Mesmo gate de loopback das escritas: o agente federado não dispara
    // turno que mexe no financeiro do Samuel.
    case 'pontos-agent-tasks': {
      if (!CONFIG.localOnly) { send(ws, { t: 'points-dfl-write', reqId: msg.reqId, kind: 'agent', ok: false, message: 'agente de tasks só no loopback' }); return; }
      const note = typeof msg.note === 'string' ? msg.note : '';
      if (Buffer.byteLength(note) > MAX_NOTE_BYTES) { send(ws, { t: 'points-dfl-write', reqId: msg.reqId, kind: 'agent', ok: false, message: 'nota grande demais' }); return; }
      const now = Date.now();
      const sessionKey = agentSessionKey(now);
      const req = { note, epicCapCents: msg.epicCapCents, monthCapCents: msg.monthCapCents, pointValue: msg.pointValue };
      startRun({
        ws: null,
        sessionKey,
        // 'drafts' = "Novo épico com agente": stages in the Deck, never in DFL.
        prompt: msg.target === 'drafts' ? buildStageDraftsPrompt(req) : buildAgentTasksPrompt(req),
        msgId: `pontos-${Date.now().toString(36)}`,
        // Turno sem cliente atrelado: sem acceptEdits ele para no primeiro pedido
        // de permissão e ninguém está lá pra aprovar. Não é bypass.
        mode: 'acceptEdits',
        effort: 'medium',
      });
      send(ws, { t: 'points-dfl-write', reqId: msg.reqId, kind: 'agent', ok: true, message: sessionKey });
      return;
    }
    // Staged DFL epics: Deck-local data (no DFL write), owner-only like the finance
    // snapshot. After a mutation every finance socket gets the new list; the file
    // watcher also covers writes made by the deck-drafts CLI.
    case 'drafts-get': {
      registerFinanceClient(ws);
      send(ws, { t: 'drafts', items: await readDrafts() });
      return;
    }
    case 'drafts-op': {
      registerFinanceClient(ws);
      if (!isDraftOp(msg.op)) { send(ws, { t: 'error', message: 'operação de rascunho inválida' }); return; }
      try {
        emitFinanceMsg({ t: 'drafts', items: await mutateDrafts(msg.op) });
      } catch (e) {
        send(ws, { t: 'error', message: e instanceof Error ? e.message : 'rascunho: falhou' });
      }
      return;
    }
    case 'crons-get': {
      send(ws, { t: 'crons', items: await getCrons() });
      return;
    }
    case 'cron-save': {
      const c = msg.cron;
      // Validação mínima da borda (frame cru): só persiste um cron bem-formado.
      if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,59}$/.test(c.id) ||
          typeof c.prompt !== 'string' || !c.prompt.trim() || !scheduleValid(c.schedule) ||
          // NaN here made an interval cron that never fires.
          !Number.isFinite(c.createdAt)) {
        send(ws, { t: 'error', message: 'cron inválido' });
        return;
      }
      send(ws, { t: 'crons', items: await saveCron(c) });
      return;
    }
    case 'cron-delete': {
      send(ws, { t: 'crons', items: await deleteCron(msg.id) });
      return;
    }
    case 'cron-run': {
      const items = await runCronNow(msg.id, fireCron);
      if (items) send(ws, { t: 'crons', items });
      else send(ws, { t: 'error', message: 'cron não encontrado' });
      return;
    }
    case 'skill-list': {
      send(ws, { t: 'skills', items: await listSkills() });
      return;
    }
    case 'skill-open': {
      const s = await readSkill(msg.id);
      if (s) send(ws, { t: 'skill', id: msg.id, name: s.name, body: s.body });
      else send(ws, { t: 'error', message: 'skill não encontrada' });
      return;
    }
    // Compartilhamento (write-path, admin-only via authz): grava um contexto/skill
    // importado na própria conta. Guards (slug/imported-/anti-traversal/cap) nas fns.
    case 'ctx-install': {
      const r = await installContext(msg.slug, msg.title, msg.body);
      send(ws, 'error' in r ? { t: 'install-result', kind: 'context', ok: false, error: r.error } : { t: 'install-result', kind: 'context', ok: true, id: r.id });
      if (!('error' in r)) send(ws, { t: 'contexts', items: await listContexts() });
      return;
    }
    case 'skill-install': {
      const r = await installSkill(msg.slug, msg.title, msg.body);
      send(ws, 'error' in r ? { t: 'install-result', kind: 'skill', ok: false, error: r.error } : { t: 'install-result', kind: 'skill', ok: true, id: r.id });
      if (!('error' in r)) send(ws, { t: 'skills', items: await listSkills() });
      return;
    }
    // DFL Skills registry (admin-only via authz). The registry is read by a child
    // process that holds the DFL token; installs verify hashes and never overwrite.
    case 'registry-get': {
      try { send(ws, { t: 'registry', catalog: await getRegistryCatalog(!!msg.refresh) }); }
      catch (e) { send(ws, { t: 'registry', catalog: null, error: (e as Error).message }); }
      return;
    }
    case 'registry-install': {
      const items = Array.isArray(msg.items) ? msg.items : [];
      try {
        const r = await installFromRegistry(items);
        const error = r.failed.length ? r.failed.map((f) => `${f.slug}: ${f.error}`).join('; ') : undefined;
        send(ws, { t: 'registry-install-result', reqId: msg.reqId, ok: r.failed.length === 0, installed: r.installed, skipped: r.skipped, error });
      } catch (e) {
        send(ws, { t: 'registry-install-result', reqId: msg.reqId, ok: false, installed: [], skipped: [], error: (e as Error).message });
      }
      send(ws, { t: 'skills', items: await listSkills() });
      return;
    }
    case 'usage-list': {
      send(ws, { t: 'usage-stats', stats: usageStats() });
      return;
    }
    case 'refresh-models': {
      // Puxa /v1/models na hora (em vez de esperar o poll horário) e re-broadcasta
      // a lista nova pra todos, pra um modelo recém-lançado aparecer no seletor.
      const models = await refreshModels();
      if (models.length) broadcast({ t: 'models', models });
      return;
    }
    case 'admin-health': {
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    // Harness de orquestração próprio (admin-only pelo authorize): motor separado da
    // CLI, gasta a chave pay-as-you-go, seleção de modelo sempre explícita.
    case 'harness-get':
    case 'harness-run': {
      // Detached de propósito (o harness roda por minutos e não pode segurar o
      // loop de mensagens), mas SEM catch a rejeição escapa do .catch da conexão
      // e cai no unhandledRejection, que derruba o backend e mata TODOS os runs.
      detach(ws, handleHarnessMsg(ws, msg));
      return;
    }
    // Admin write-ops (#162). authorize() já garante role admin (default-deny);
    // re-emite health depois de cada escrita p/ a UI refletir na hora.
    case 'admin-env-set': {
      if (!CONFIG.localOnly && !envNameAllowedRemotely(msg.name)) {
        send(ws, { t: 'admin-op', ok: false, message: `${msg.name} só no loopback` });
        return;
      }
      const r = await setEnv(msg.name, msg.value);
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-env-unset': {
      const r = await unsetEnv(msg.name);
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-mcp-add': {
      // MCP stdio = subprocesso arbitrário que o `claude` spawna depois → RCE.
      // Mesmo gate do cli-install: stdio só no loopback. URL (http) pode remoto.
      if (msg.command && !CONFIG.localOnly) {
        send(ws, { t: 'admin-op', ok: false, message: 'MCP stdio só no loopback' });
        return;
      }
      const r = await addMcp(msg.name, { command: msg.command, url: msg.url });
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-mcp-remove': {
      const r = await removeMcp(msg.name);
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-cli-install': {
      // RCE → só loopback (box do dono). Fora do loopback (agente na VPS federada)
      // a instalação é negada mesmo pro admin.
      if (!CONFIG.localOnly) {
        send(ws, { t: 'admin-op', ok: false, message: 'instalação só no loopback' });
        return;
      }
      const r = await installCli(msg.name);
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-cli-update': {
      if (!CONFIG.localOnly) {
        send(ws, { t: 'admin-op', ok: false, message: 'atualização do CLI só no loopback' });
        return;
      }
      const r = await updateClaudeCli();
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    case 'admin-deck-restart': {
      if (!CONFIG.localOnly) {
        send(ws, { t: 'admin-op', ok: false, message: 'restart do Deck só no loopback' });
        return;
      }
      if (msg.mode === 'now') {
        // O restart mata ESTE processo: responde antes, e dá um ciclo pro frame
        // sair pela rede — senão a UI só vê o socket cair, sem saber por quê.
        send(ws, { t: 'admin-op', ok: true, message: 'reiniciando agora — o Deck volta em alguns segundos' });
        setTimeout(() => { restartDeck('now').catch(() => {}); }, 300);
        return;
      }
      const r = await restartDeck('idle');
      send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
      send(ws, { t: 'health', health: await collectHealth() });
      return;
    }
    // Único caminho de upload: o browser fatia o base64 em chunks (cada frame sob o
    // cap do relay), o backend remonta e espelha no S3 server-side. null = ainda
    // faltam chunks (não responde).
    case 'upload-chunk': {
      const r = await addUploadChunk(msg.uploadId, msg.sessionKey, msg.name, msg.seq, msg.total, msg.dataB64);
      if (r === null) return;
      if ('error' in r) send(ws, { t: 'error', message: r.error });
      else send(ws, { t: 'uploaded', name: msg.name, path: r.path, text: r.text, s3url: r.s3url, clientId: msg.clientId, sessionKey: msg.sessionKey });
      return;
    }
    case 'att-open': {
      const r = await readAttachment(msg.path);
      if ('error' in r) send(ws, { t: 'attachment', path: msg.path, name: msg.path, error: r.error });
      else send(ws, { t: 'attachment', path: msg.path, name: r.name, dataB64: r.dataB64 });
      return;
    }
    case 'stop': {
      // stopSession resolve a chave real do thread (o servidor keyeia pelo id de
      // início e nunca re-keyea) antes de marcar o stop e matar — senão o
      // threads.get() dava miss com a chave migrada e o kill virava no-op.
      stopSession(msg.sessionKey);
      return;
    }
    case 'send': {
      // Skills selecionadas pela UI viram regras de negação das NÃO-selecionadas
      // (Skill(id)). Resolvido aqui (async) e passado adiante; vazio = todas ativas.
      const disallowedSkills = await resolveSkillDeny(msg.skills);
      // Sessão ocupada → triador decide o destino (esperar/responder/prioridade/
      // juntar). Livre → roda direto como antes.
      const opts = {
        ws,
        sessionKey: msg.sessionKey,
        prompt: msg.text,
        resumeId: msg.sessionId,
        msgId: msg.msgId,
        mode: msg.mode,
        model: msg.model,
        maxBudgetUsd: msg.maxBudgetUsd,
        bypass: msg.bypass,
        role,
        disallowedSkills,
        mcps: msg.mcps,
        effort: msg.effort,
        allowWorkflow: msg.allowWorkflow === true ? true : undefined,
      };
      // Server-side double-writer guard: a client-side flag (canvas prompt bar
      // disabled after "retomar") is only a UX hint — it resets on an F5 or a
      // second tab and can't see a pane resumed BY HAND outside Deck. The
      // ground truth is the watch pane's own process tree: if it already has
      // an interactive `claude` in it, ANY 'send' here (canvas or the normal
      // composer) would start a SECOND writer on the same transcript. Cheap:
      // only sessions with an open watch pane pay for the /proc scan.
      const checkId = msg.sessionId ?? msg.sessionKey;
      if (await hasInteractiveClaude(checkId)) {
        // send-reject (not a plain error): the composer (canvas or main) must
        // restore the text and drop the optimistic bubble by msgId, same as
        // every other pre-spawn refusal — a bare 'error' just shows a toast
        // and leaves the bubble orphaned.
        send(ws, {
          t: 'send-reject', sessionKey: msg.sessionKey, reason: 'live-elsewhere', text: msg.text, msgId: msg.msgId,
          message: 'Essa sessão já está aberta num terminal interativo (retomada) — feche-o antes de mandar mensagem por aqui.',
        });
        return;
      }
      // Cross-process double-writer guard: resolveThreadKey below only
      // searches THIS process's own `threads` map. Deck runs two backend
      // processes (server/index.ts, server/agent.ts), each with its own map
      // — a session already live in the OTHER one is invisible here, and
      // starting a `claude --resume` on it would fork the transcript exactly
      // like the same-process hasInteractiveClaude case above. FRESH read,
      // not a cached getter: startCvLivenessLoop's cache only updates while
      // a client is connected, and deckctl's connection (a few seconds) can
      // come and go between 5s ticks without ever refreshing it — acting on
      // that cache here would sometimes block on data hours old. Fails OPEN
      // (best-effort registry read; nothing here can safely block a send by
      // erroring). Deliberately NOT the display-liveness list: that one's
      // fresh-mtime grace period would reject an ordinary follow-up sent
      // within ~2min of the OTHER process's turn closing, when nobody is
      // actually racing anymore — readBusyElsewhereSessionIds has no such
      // grace period, and already subtracts THIS process's own threads, so
      // any match here is by construction someone else's turn right now.
      //
      // Placement matters, twice over:
      // 1) BEFORE resolveThreadKey, not after — a session can also be
      //    "busy elsewhere" because it's the Orchestrator's own live pane
      //    (checked first, no I/O), which startRun redirects into instead of
      //    spawning a run; checking that FIRST means the common case (not
      //    the Orchestrator) skips a needless registry read. But the reason
      //    it must run before resolveThreadKey, not merely before startRun,
      //    is #2:
      // 2) Everything from resolveThreadKey to startRun/routeSend below is
      //    now ONE synchronous block with no `await` inside it. Two 'send's
      //    for the same session landing a few ms apart used to both find
      //    `liveKey` undefined, both await this guard, and both fall through
      //    to startRun — the second call's admission logic (runs.ts,
      //    `replacing`) then REPLACES and kills the thread the first call
      //    just created. Awaiting first and deciding liveKey/startRun
      //    without yielding in between means whichever 'send' resolves its
      //    await LAST always sees the OTHER's thread already registered,
      //    and gets routed to routeSend (queued) instead of replacing it.
      const target = msg.sessionId ?? msg.sessionKey;
      if (!orchestratorPaneTarget(target, role)) {
        const busyElsewhere = await readBusyElsewhereSessionIds().catch(() => [] as string[]);
        if (busyElsewhere.includes(target)) {
          send(ws, {
            t: 'send-reject', sessionKey: msg.sessionKey, reason: 'live-elsewhere', text: msg.text, msgId: msg.msgId,
            message: 'Essa sessão já tem um turno rodando no outro processo do Deck (deckctl/agente) — espere ele terminar antes de mandar mensagem por aqui.',
          });
          return;
        }
      }
      // A session can already be live under a DIFFERENT thread key than the one
      // this frame names (a cron run, a card/flow's own key) — resolveThreadKey
      // finds it by sessionId so this message reaches the real turn (routeSend's
      // triage) instead of blindly spawning a second `claude --resume` on top of
      // it (canvas review #593: double-writer from the canvas prompt bar).
      const liveKey = resolveThreadKey(msg.sessionKey);
      // displayKey: routeSend's own early checks (before any 'triage' frame,
      // which is what the client's aliasRoutedKey correlation needs) fire
      // under the ROUTING key — when it differs from what this frame named,
      // tell routeSend to report those specific errors under the ORIGINAL key
      // instead, so a canvas send rerouted onto a different live thread still
      // correlates (canvas review #593 third pass item 4).
      if (liveKey) { detach(ws, routeSend({ ...opts, sessionKey: liveKey, displayKey: msg.sessionKey }), liveKey); return; }
      startRun({ ...opts, auto: msg.auto === true });
      return;
    }
    // Fila estacionada (overnight/quota-out): persiste o prompt no servidor pro
    // drainer disparar sozinho quando a sessão ficar ociosa E a quota voltar, sem
    // depender do browser aberto. Mesma resolução de skills do 'send'. Broadcast do
    // snapshot pra todos os aparelhos verem a fila mudar ao vivo.
    case 'queue-add': {
      const disallowedSkills = await resolveSkillDeny(msg.skills);
      const r = addParked(msg.sessionKey, {
        prompt: msg.text,
        resumeId: msg.sessionId,
        mode: msg.mode,
        model: msg.model,
        effort: msg.effort,
        maxBudgetUsd: msg.maxBudgetUsd,
        bypass: msg.bypass,
        role,
        disallowedSkills,
        mcps: msg.mcps,
      });
      // Recusa muda apagava o prompt: o composer limpa o texto ao enfileirar e a
      // fila não ecoa bolha nenhuma. Devolve o texto pro cliente com o motivo.
      if ('reject' in r) {
        send(ws, { t: 'queue-reject', sessionKey: msg.sessionKey, text: msg.text, message: REJECT_MESSAGE[r.reject] });
        return;
      }
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      // Enfileirar com a sessão já ociosa (turno morreu, quota voltou) esperava o
      // tick de 30s à toa. No processo sem drainer isto é no-op.
      drainParked();
      return;
    }
    case 'queue-remove': {
      removeParked(msg.sessionKey, msg.id, role ?? 'student');
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      return;
    }
    case 'queue-edit': {
      const ok = editParked(msg.sessionKey, msg.id, msg.text, role ?? 'student'); // sem role identificada = menor privilégio
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      // O textarea da fila já fechou quando isto chega: uma recusa calada levava o
      // texto que o usuário acabou de digitar junto.
      if (!ok) send(ws, { t: 'queue-error', sessionKey: msg.sessionKey, message: 'não deu pra editar este item da fila (ele pode já ter saído pra rodar)' });
      return;
    }
    case 'queue-move': {
      if (msg.dir === -1 || msg.dir === 1) moveParked(msg.sessionKey, msg.id, msg.dir);
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      return;
    }
    case 'queue-clear': {
      clearParked(msg.sessionKey, role ?? 'student');
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      return;
    }
    case 'queue-set-paused': {
      setQueuePaused(msg.paused === true);
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      if (msg.paused !== true) drainParked(); // retomar não espera o próximo tick
      return;
    }
    // Destrava o item que bateu o teto de tentativas e tenta de novo na hora.
    case 'queue-retry': {
      retryParked(msg.sessionKey, msg.id);
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      drainParked();
      return;
    }
    // Abre mão da pergunta pendente: a fila volta a drenar nesta sessão sem que o
    // usuário responda o card.
    case 'queue-force': {
      clearAwaiting(msg.sessionKey);
      drainParked();
      // Sem este snapshot o clique não mudava NADA na tela quando o dreno não
      // subiu nada (outro processo é quem drena, ou a sessão não era a da vez):
      // o banner seguia igual e o botão parecia morto.
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      return;
    }
    // Tira o item da fila e roda AGORA num chat paralelo, forkando o contexto deste
    // chat. Não espera a sessão liberar e não encosta no turno em andamento.
    case 'queue-run-bg': {
      const r = runParkedInBackground(msg.sessionKey, msg.id, role ?? 'student', typeof msg.model === 'string' ? msg.model : undefined);
      if ('reject' in r) { send(ws, { t: 'queue-error', sessionKey: msg.sessionKey, message: BG_RUN_MESSAGE[r.reject] }); return; }
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      return;
    }
    // Fura a fila: o item vai pro topo e o turno em andamento é interrompido pra
    // ele subir no lugar. O broadcast do snapshot mostra a nova ordem; o turno que
    // sobe vem do dreno no onClose do turno morto.
    case 'queue-run-now': {
      const r = runParkedNow(msg.sessionKey, msg.id, role ?? 'student');
      if ('reject' in r) { send(ws, { t: 'queue-error', sessionKey: msg.sessionKey, message: NOW_RUN_MESSAGE[r.reject] }); return; }
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      return;
    }
    case 'queue-get': {
      send(ws, { t: 'queue', items: parkedView(), paused: isQueuePaused() });
      return;
    }
    // Clique na oferta de retomada: o servidor ainda guarda a config do turno
    // morto, então isto vira um `--resume` de verdade e não um reenvio de texto.
    case 'resume-run': {
      await refreshBusyElsewhere();
      if (!acceptResumeOffer(msg.sessionKey)) {
        send(ws, { t: 'queue-error', sessionKey: msg.sessionKey, message: 'Esta retomada não está mais disponível (a sessão já tem turno novo).' });
      }
      return;
    }
    // Fork imediato de um card do canvas (session-reuse.ts "fork"): mesma base
    // de queue-add + queue-run-bg, fundida num round-trip só. AO CONTRÁRIO de
    // 'queue-run-bg', uma recusa (ou uma morte do fork sem produzir nada)
    // NUNCA deixa o item pra trás na fila do pai — ele é o prompt de OUTRO
    // card, não um follow-up da sessão-mãe; se sobrasse ali, o dreno passivo
    // (drainParked) acabaria mandando o prompt do card errado pro próximo
    // turno ocioso da sessão-mãe (review #597 point 1). Por isso remove em
    // toda rejeição e chama runParkedInBackground com attachRecovery=false
    // (não amarra recuperação-por-fila a este fork: se ele morrer no meio, o
    // prompt só some — nunca reaparece na fila de ninguém).
    case 'canvas-card-fork': {
      const disallowedSkills = await resolveSkillDeny(msg.skills);
      const parked = addParked(msg.parentSessionId, {
        prompt: msg.text, resumeId: msg.parentSessionId, mode: msg.mode, model: msg.model,
        effort: msg.effort, maxBudgetUsd: msg.maxBudgetUsd, bypass: msg.bypass, role, disallowedSkills, mcps: msg.mcps,
      });
      if ('reject' in parked) {
        send(ws, { t: 'canvas-card-fork-reject', cardId: msg.cardId, parentSessionId: msg.parentSessionId, message: REJECT_MESSAGE[parked.reject] });
        return;
      }
      // attachRecovery=false: review #597 point 1. enforceHardCtxCap=true: a
      // fork target picked by the ranking DEFAULT (not necessarily a session
      // the user themselves sized up) must respect the same hard ctx cap a
      // normal turn would — review #597 point 2.
      const r = runParkedInBackground(msg.parentSessionId, parked.id, role, msg.model, false, true);
      if ('reject' in r) {
        // Recusa antes do take (sem-contexto/sem-quota/sem-slot/ctx-grande)
        // deixa o item ainda parqueado; 'falhou' (spawn quebrou) o devolve com
        // o MESMO id (unshiftParked preserva). Os dois casos: remove agora,
        // sem exceção.
        removeParked(msg.parentSessionId, parked.id, role);
        broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
        send(ws, { t: 'canvas-card-fork-reject', cardId: msg.cardId, parentSessionId: msg.parentSessionId, message: CANVAS_FORK_MESSAGE[r.reject] });
        return;
      }
      broadcast({ t: 'queue', items: parkedView(), paused: isQueuePaused() });
      // The only place this relation is ever produced — see fork-sessions.ts.
      // Feeds the chain-of-command view's "forked from" link.
      bindForkSession(r.forkId, msg.parentSessionId);
      send(ws, { t: 'canvas-card-fork-ok', cardId: msg.cardId, parentSessionId: msg.parentSessionId, forkId: r.forkId });
      return;
    }
  }
}
