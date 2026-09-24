import { randomUUID } from 'node:crypto';
import {
  AREA_LABELS, DEFAULT_FLOW_TEMPLATE, FLOW_MARKER_RE, cardNodeId, flowMarker, sessionNodeId,
  type AreaId, type CanvasCard, type CanvasFlow, type CanvasNode, type ContentFormat,
} from '../../shared/canvas';
import { buildContentPrompt, buildContinuePrompt, buildTaskPrompt } from '../../shared/canvas-prompt';
import { listContexts } from '../contexts';
import { listArchived, listSessions } from '../sessions/index';
import { emitCanvasMsg } from '../ws/canvas-clients';
import { enqueuePending } from '../ws/pending';
import { addParked, removeParked } from '../ws/parked';
import { resumableId } from '../ws/resume';
import { isDrainerEnabled, orchestratorPaneTarget, runParkedInBackground, startRun } from '../ws/runs';
import { resolveThreadKey, threads, type RunParams } from '../ws/threads';
import { bindCardSession, cardIdForSession, lastCardMarker, neutralizeMarkers } from './card-sessions';
import { cardIdFromRefsCache } from './index';
import { claimFlowFire, markCardDoing, readBoardChained, recordFlowFailure, recordFlowSuccess, updateBoard } from './board';
import { clearFlowRun, registerFlowRun } from './flow-runs';
import { blockedAreaFor } from './autopause-loop';
import { hasInteractiveClaude } from './term-stats';
import { readBusyElsewhereSessionIds } from './cv-liveness';
import { onTurnClosed, type TurnClosed } from './turn-hooks';

export { neutralizeMarkers };

// The orchestrator: when a turn closes ok, whatever flows start at its
// session (or at the card it was bound to) fire, delivering the turn's text
// as the next prompt. Fires with the browser closed — this listens on
// onTurnClosed (server/canvas/turn-hooks.ts), which server/ws/runs.ts emits
// once per turn close regardless of whether a client is attached.

// Chain depth cap: hops 1..MAX_HOPS are allowed to fire (that many
// flow-driven turns), hop MAX_HOPS+1 is blocked.
export const MAX_HOPS = 5;
// Same flow can't refire within this window — a fast back-and-forth pair of
// flows would otherwise ping-pong every turn close forever (until MAX_HOPS).
export const FLOW_RATE_LIMIT_MS = 60_000;
// The prompt only needs the TAIL of a long result — keeps the target turn's
// input bounded no matter how long the source ran.
export const MAX_RESULT_CHARS = 12_000;
// Exponential backoff for a flow whose delivery keeps failing (target gone,
// concurrency cap, ...): 1m, 2m, 4m, ..., capped at 30m. Without this, a flow
// stuck failing would retry on EVERY source turn close, which for a chatty
// source can be every few seconds.
export const BACKOFF_BASE_MS = 60_000;
export const BACKOFF_MAX_MS = 30 * 60_000;
// A failure caused by the TARGET AREA sitting over budget (autopause's own
// admission gate, isAreaAdmissionBlocked) is not "broken" the way a vanished
// target or a hard concurrency cap is — the area is expected to come back
// under budget within minutes on its own. Capping its backoff far below
// BACKOFF_MAX_MS means the flow resumes soon after the area recovers instead
// of sitting out the same ~30min ceiling a genuinely dead target earns.
export const AREA_BLOCKED_BACKOFF_MAX_MS = 2 * 60_000;

// --- pure: what fires, at what hop, with what text --------------------------

export function flowResult(text: string): string {
  const capped = text.length > MAX_RESULT_CHARS ? text.slice(-MAX_RESULT_CHARS) : text;
  return neutralizeMarkers(capped);
}

// {{result}} substitutes in place; an empty/missing placeholder appends the
// result after the template instead of dropping it silently.
export function fillTemplate(template: string, result: string): string {
  const t = template.trim() ? template : DEFAULT_FLOW_TEMPLATE;
  return t.includes('{{result}}') ? t.split('{{result}}').join(result) : `${t}\n\n${result}`;
}

export function buildFlowPrompt(flow: Pick<CanvasFlow, 'id' | 'template'>, result: string, hop: number): string {
  return `${fillTemplate(flow.template, result)}\n\n${flowMarker(flow.id, hop)}`;
}

// LAST match wins, not first — same reasoning as card-sessions.ts's
// lastCardMarker: an injected/echoed marker earlier in the string must never
// outrank the real, trailing one this module always appends last.
export function hopOfPrompt(prompt: string): number {
  let m: RegExpMatchArray | undefined;
  for (const c of prompt.matchAll(new RegExp(FLOW_MARKER_RE.source, 'g'))) m = c;
  if (!m) return 0;
  const hop = Number(m[2]);
  return Number.isFinite(hop) && hop >= 0 ? hop : 0;
}

export function rateLimited(flow: Pick<CanvasFlow, 'lastFiredAt'>, now: number): boolean {
  return !!flow.lastFiredAt && now - flow.lastFiredAt < FLOW_RATE_LIMIT_MS;
}

export function backoffMs(failStreak: number, areaBlocked?: boolean): number {
  if (failStreak <= 0) return 0;
  const cap = areaBlocked ? AREA_BLOCKED_BACKOFF_MAX_MS : BACKOFF_MAX_MS;
  return Math.min(cap, BACKOFF_BASE_MS * 2 ** (failStreak - 1));
}

export function backedOff(flow: Pick<CanvasFlow, 'failStreak' | 'lastFailedAt' | 'lastFailAreaBlocked'>, now: number): boolean {
  if (!flow.failStreak || flow.lastFailedAt === undefined) return false;
  return now - flow.lastFailedAt < backoffMs(flow.failStreak, flow.lastFailAreaBlocked);
}

export interface FlowFire { flow: CanvasFlow; hop: number }

export interface ClosedTurnForFlows {
  ok: boolean;
  sessionId?: string;
  prompt: string;
  unattended: boolean;
  // Thread.flowHop, carried through server/ws/runs.ts's TurnClosed.hop — the
  // source of truth for a RESUMED or QUEUED turn, whose prompt text is
  // RESUME_PROMPT (or a plain queued prompt) and carries no marker at all.
  hop?: number;
  // Resolved sessionId→cardId binding beyond whatever this turn's own prompt
  // carries (server/canvas/card-sessions.ts) — a follow-up turn in a
  // card-bound session has no marker of its own, only the FIRST turn does.
  boundCardId?: string;
}

// Only a turn that finished cleanly (ok, computed by server/ws/runs.ts's
// isCleanTurnClose) can fire anything. cron/marathon turns are unattended: no
// human is around to see (or approve) whatever a chained flow does next, so
// they never fire. Source matching: the session that just closed, plus —
// when the prompt carries the card marker OR a resolved binding says so —
// the card that session ran for.
export function selectFlowsToFire(t: ClosedTurnForFlows, flows: CanvasFlow[], now: number): FlowFire[] {
  if (!t.ok || t.unattended) return [];
  // t.hop (Thread.flowHop) is the source of truth for a turn whose PROMPT
  // carries no marker (a crash-resume rewrites it to RESUME_PROMPT; a queued
  // turn's prompt is whatever the user/flow originally queued) — reading only
  // hopOfPrompt(t.prompt) here silently reset the chain depth to 0 on every
  // such resume, defeating MAX_HOPS. The prompt's own marker can still be the
  // larger of the two (this turn was itself freshly delivered by a flow, and
  // t.hop and the marker agree) — take whichever is larger, never smaller.
  const hop = Math.max(t.hop ?? 0, hopOfPrompt(t.prompt)) + 1;
  if (hop > MAX_HOPS) return [];
  const sources = new Set<string>();
  if (t.sessionId) sources.add(sessionNodeId(t.sessionId));
  const cardId = lastCardMarker(t.prompt) ?? t.boundCardId;
  if (cardId) sources.add(cardNodeId(cardId));
  if (!sources.size) return [];
  return flows
    .filter((f) => f.enabled && sources.has(f.from) && !rateLimited(f, now) && !backedOff(f, now))
    .map((flow) => ({ flow, hop }));
}

// --- impure: actually deliver the prompt -------------------------------------

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

// The source turn's own params are UNTRUSTED to inherit wholesale: its text
// is model output, steerable by whatever the source read (a memory file, a
// tool result, another agent) — a flow is exactly the kind of pivot a
// prompt-injection would want (bypassPermissions on a target the attacker
// picked). bypass NEVER propagates. mcps defaults to none — a flow opts a
// target INTO a specific MCP set (CanvasFlow.mcps), it never inherits the
// source's. mode may be overridden per flow; unset inherits the source's
// (plan/auto/acceptEdits — bypass is the separate, always-false flag above).
function safeParams(source: RunParams, flow: Pick<CanvasFlow, 'mode' | 'mcps'>): RunParams {
  return {
    mode: flow.mode ?? source.mode,
    model: source.model,
    effort: source.effort,
    maxBudgetUsd: source.maxBudgetUsd,
    bypass: false,
    role: source.role,
    disallowedSkills: source.disallowedSkills,
    mcps: flow.mcps ?? [],
  };
}

// Shared with CardDelivery below: `areaBlocked`, when set, is the AreaId that
// refused admission — distinguishes "the target's area is over budget,
// autoPause is on" from any other failure to deliver. fireFlow uses it to
// name the area in a dedicated pt toast and to cap backoff much shorter
// (AREA_BLOCKED_BACKOFF_MAX_MS) than a genuinely broken target earns.
export interface DeliveryResult { delivered: boolean; areaBlocked?: AreaId }

// Target `s:<uuid>`: continue the existing session. Delivery only counts once
// a thread actually admitted (threads.get after the call — same check
// runParkedInBackground uses at server/ws/runs.ts around admitRun): a
// concurrency-cap rejection, a hard-context block, or an invalid sessionKey
// all return from startRun/addParked/enqueuePending having done nothing.
export async function deliverToSession(sessionId: string, prompt: string, source: RunParams, flow: CanvasFlow, hop: number): Promise<DeliveryResult> {
  const resume = resumableId(sessionId);
  if (!resume) return { delivered: false }; // transcript gone — nothing to continue
  const params = safeParams(source, flow);
  const liveKey = resolveThreadKey(sessionId);
  if (liveKey) {
    // A live run in THIS process: addParked only actually drains where a
    // drainer ticks (server/ws/runs.ts startParkedDrainer, agent-only). On a
    // process without one (e.g. the loopback index), the item would sit on
    // disk forever — use the in-process pending queue instead, which THIS
    // process's own onClose drains unconditionally (drainPending, unlike
    // drainParked, isn't gated on the drainer flag).
    //
    // Neither queue threads flowHop onto the eventual Thread (parked items
    // round-trip through disk with a fixed shape; pending ones aren't
    // per-thread until they actually run), so that later turn's OWN
    // Thread.flowHop starts back at 0 — but `prompt` already carries this
    // flow's `[deck-flow:<id>:<hop>]` marker (buildFlowPrompt, below), and
    // selectFlowsToFire takes max(Thread.flowHop, hopOfPrompt(prompt)), so
    // the string marker alone still recovers the correct depth once that
    // queued turn eventually closes.
    if (isDrainerEnabled()) {
      const r = addParked(liveKey, { ...params, prompt, resumeId: resume });
      return { delivered: !('reject' in r) };
    }
    // Queueing behind a session that's ALREADY live (attended right now, same
    // as a user reply landing mid-turn) is never area-gated — only admitting
    // brand-new unattended work is (review #595 second pass, point 2: "leave
    // the in-turn pending queue alone").
    return { delivered: enqueuePending(liveKey, { ...params, ws: null, prompt, merge: false }) };
  }
  // No live thread: this WOULD start a brand-new unattended turn. If the
  // target's area is over budget with autoPause on, treat it exactly like any
  // other failed delivery — fireFlow's caller already arms the backoff and
  // retries later, once the area (hopefully) isn't over anymore.
  const blocked = blockedAreaFor(resume);
  if (blocked) return { delivered: false, areaBlocked: blocked };
  // The Orchestrator's session lives in its tmux pane: startRun types the prompt
  // there and returns 'pane' with no thread. That IS a delivery — read as a
  // failure, the "report back" arrow backed off and skipped later results.
  if (orchestratorPaneTarget(resume, params.role)) {
    return { delivered: startRun({ ws: null, sessionKey: resume, prompt, resumeId: resume, flowHop: hop, ...params }) === 'pane' };
  }
  // Same double-writer guards 'send' runs (dispatch.ts): a session driven by an
  // interactive `claude` in a pane, or live in the OTHER Deck process, is not in
  // this process's `threads`, and a `claude -p --resume` here would be a second
  // writer on its transcript. Not delivered = fireFlow backs off and retries.
  if (await hasInteractiveClaude(resume)) return { delivered: false };
  if ((await readBusyElsewhereSessionIds().catch(() => [] as string[])).includes(resume)) return { delivered: false };
  // Those awaits did real I/O: a turn may have started here meanwhile.
  if (resolveThreadKey(sessionId)) return { delivered: false };
  const r = startRun({ ws: null, sessionKey: resume, prompt, resumeId: resume, flowHop: hop, ...params });
  return { delivered: r === 'pane' || threads.has(resume) };
}

async function resolveCardNodes(contextIds: string[], sessionIds: string[]): Promise<{ contexts: CanvasNode[]; sessions: CanvasNode[] }> {
  // Cheap, targeted reads — NOT buildCanvas: that rebuilds the whole graph
  // (rescans every transcript for memory refs) and, worse, ignores its
  // `board` argument whenever a build from another caller is already in
  // flight (server/canvas/index.ts inflight promise), so a card fire could
  // silently reuse a stale/unrelated board mid-build.
  const contexts: CanvasNode[] = [];
  if (contextIds.length) {
    const metas = await listContexts();
    for (const id of contextIds) {
      const c = metas.find((m) => m.id === id);
      if (c) contexts.push({ id: `c:${c.id}`, kind: 'context', ref: c.id, title: c.title, subtitle: c.description, mtime: c.mtime });
    }
  }
  const sessions: CanvasNode[] = [];
  if (sessionIds.length) {
    const [live, archived] = await Promise.all([listSessions(), listArchived()]);
    const metas = [...live, ...archived];
    for (const id of sessionIds) {
      const s = metas.find((m) => m.id === id);
      if (s) sessions.push({ id: `s:${s.id}`, kind: 'session', ref: s.id, title: s.title, subtitle: s.snippet, mtime: s.mtime });
    }
  }
  return { contexts, sessions };
}

export interface CardDelivery { delivered: boolean; runKey?: string; areaBlocked?: AreaId }

// Target `k:<cardId>`: run the card as a brand new session, same prompt shape
// runCard builds client-side (buildTaskPrompt/buildContentPrompt, which end
// with the card marker), prefixed with the flow's template applied to the
// result. Key is `new-<uuid>`, not a bare uuid: that's the exact prefix
// src/useCockpit.ts's migrateKey looks for on 'done' to fold the placeholder
// into the real session id — a bare uuid key has no such reconciliation and
// would leave an orphan bubble no sidebar entry ever matches.
async function deliverToNewSession(card: CanvasCard, flow: CanvasFlow, result: string, hop: number, source: RunParams): Promise<CardDelivery> {
  const { contexts, sessions } = await resolveCardNodes(card.contextIds, card.sessionIds);
  // A card has no area of its own (server/canvas/areas.ts never classifies
  // cards) — this ALWAYS starts a brand-new session (no live-thread branch to
  // exempt, unlike deliverToSession), so the best available signal is whether
  // any session the card is already bound to sits in a blocked area. No bound
  // session at all (a fresh card) has nothing to check against — fails open,
  // same as isAreaAdmissionBlocked's own default.
  const blockedByBoundSession = sessions.map((s) => blockedAreaFor(s.ref)).find((a): a is AreaId => !!a);
  if (blockedByBoundSession) return { delivered: false, areaBlocked: blockedByBoundSession };
  const basePrompt = card.kind === 'content'
    ? buildContentPrompt(card, (card.format ?? 'post') as ContentFormat, contexts, sessions, today())
    : buildTaskPrompt(card, contexts, sessions);
  const prompt = `${fillTemplate(flow.template, result)}\n\n${basePrompt}\n\n${flowMarker(flow.id, hop)}`;
  const sessionKey = `new-${randomUUID()}`;
  startRun({ ws: null, sessionKey, prompt, flowHop: hop, ...safeParams(source, flow) });
  if (!threads.has(sessionKey)) return { delivered: false }; // admission refused (concurrency cap, ctx gate, ...): nothing started
  return { delivered: true, runKey: sessionKey };
}

// Target `k:<cardId>` whose card.reuse (#597 CardReusePicker) says 'continue'
// or 'fork' instead of 'new': the session already has this card's contexts
// (buildContinuePrompt skips the re-seed, same as runCard's own client-side
// reuse branch), so this delivers through the SAME server primitives a manual
// click already goes through — never a parallel reimplementation of what
// "continue"/"fork" do to a session.
async function deliverToReuseTarget(card: CanvasCard, flow: CanvasFlow, result: string, hop: number, source: RunParams): Promise<CardDelivery> {
  const sessionId = card.reuse?.sessionId;
  if (!sessionId) return { delivered: false };
  const params = safeParams(source, flow);
  const prompt = `${fillTemplate(flow.template, result)}\n\n${buildContinuePrompt(card)}\n\n${flowMarker(flow.id, hop)}`;

  // Fork never touches the live turn, but it's still a brand-new unattended
  // spawn on the PARENT session's own area — same gate deliverToNewSession
  // applies to a card's bound sessions (review: fork skipped it entirely).
  const viaFork = async (): Promise<CardDelivery> => {
    const blockedArea = blockedAreaFor(sessionId);
    if (blockedArea) return { delivered: false, areaBlocked: blockedArea };
    const parked = addParked(sessionId, { ...params, prompt, resumeId: sessionId });
    if ('reject' in parked) return { delivered: false };
    // Same call dispatch.ts's 'canvas-card-fork' makes: attachRecovery=false
    // (review #597 point 1 — a dead fork must never leak this card's prompt
    // into the parent session's own queue) and enforceHardCtxCap=true (point
    // 2 — an automated pick never gets the "explicit intent" waiver a manual
    // click does). flowHop threaded through so a crashed fork's auto-resume
    // keeps the chain depth instead of resetting to 0.
    const r = runParkedInBackground(sessionId, parked.id, params.role, params.model, false, true, hop);
    if ('reject' in r) {
      removeParked(sessionId, parked.id, params.role);
      return { delivered: false };
    }
    return { delivered: true, runKey: r.forkId };
  };

  // A 'continue' target can have gone from idle to running SINCE the card was
  // saved — sending into a LIVE turn needs the human triage a real 'send'
  // gets (routeSend), never right for an automated flow pick (useCanvasRoute.ts
  // runCard's own rule, review #597 point 4). Fall back to the exact fork path
  // 'fork' mode uses instead of ever touching the live turn.
  if (card.reuse?.mode === 'fork' || resolveThreadKey(sessionId)) return viaFork();

  // Not running: 'continue' is a send into an idle session — same
  // resumability check and area-admission gate deliverToSession's own
  // no-live-thread branch already applies, plus the double-writer guard
  // dispatch.ts's 'send' case runs before ANY spawn (a pane resumed BY HAND
  // has no thread in `threads` for resolveThreadKey above to have caught).
  const resume = resumableId(sessionId);
  if (!resume) return { delivered: false };
  const blockedArea = blockedAreaFor(resume);
  if (blockedArea) return { delivered: false, areaBlocked: blockedArea };
  // A card continuing into the Orchestrator: startRun pastes into its pane ('pane',
  // no thread) — a delivery, same as deliverToSession. Checked before the
  // interactive/busy guards, which would otherwise refuse or FORK its whole
  // transcript (its claude is interactive and reads busy while it works).
  if (orchestratorPaneTarget(resume, params.role)) {
    return { delivered: startRun({ ws: null, sessionKey: resume, prompt, resumeId: resume, flowHop: hop, ...params }) === 'pane' };
  }
  if (await hasInteractiveClaude(sessionId)) return { delivered: false };
  // hasInteractiveClaude just awaited real I/O (a /proc scan) — a user could
  // have sent into this session in that exact window, making it live. startRun
  // on an already-live sessionKey takes the `replacing` branch and KILLS that
  // fresh turn (`threads.get(sessionKey)!.handle.kill()`), which a background
  // flow firing must never do. Re-check immediately before the spawn — not
  // just once, before the await — and fall back to fork if it's live now.
  // Live in the other Deck process (not in this process's threads): fork
  // instead of a second writer, same as a live turn here.
  if ((await readBusyElsewhereSessionIds().catch(() => [] as string[])).includes(resume)) return viaFork();
  if (resolveThreadKey(sessionId)) return viaFork();
  const r = startRun({ ws: null, sessionKey: resume, prompt, resumeId: resume, flowHop: hop, ...params });
  if (r === 'pane') return { delivered: true };
  return threads.has(resume) ? { delivered: true, runKey: resume } : { delivered: false };
}

export async function deliverToCard(cardId: string, flow: CanvasFlow, result: string, hop: number, source: RunParams): Promise<CardDelivery> {
  const board = await readBoardChained();
  const card = board.cards.find((c) => c.id === cardId);
  if (!card) return { delivered: false };
  const delivery = card.reuse?.mode === 'continue' || card.reuse?.mode === 'fork'
    ? await deliverToReuseTarget(card, flow, result, hop, source)
    : await deliverToNewSession(card, flow, result, hop, source);
  // areaBlocked (#599) has to survive this early return too — fireFlow reads
  // it off deliverToCard's own result to pick the dedicated toast/backoff,
  // and a card target is exactly as area-gateable as an `s:` one.
  if (!delivery.delivered) return { delivered: false, areaBlocked: delivery.areaBlocked };
  // A pane delivery (the Orchestrator) is delivered but has no run of ours: no
  // turn-closed ever fires for it, so a card marked doing here would never move to
  // review. Leave its status alone.
  if (!delivery.runKey) return delivery;
  await updateBoard((b) => markCardDoing(b, cardId, Date.now()));
  // Live until handleTurnClosed sees this exact runKey close (below) — read
  // back by server/ws/dispatch.ts on every canvas-board answer, so a tab
  // that (re)connects mid-run still sees the card running, reuse or not.
  registerFlowRun(delivery.runKey, cardId, flow.id);
  return delivery;
}

export async function fireFlow(flow: CanvasFlow, hop: number, result: string, params: RunParams): Promise<void> {
  // Claim the right to fire FIRST, atomically, inside one updateBoard
  // snapshot — otherwise two turns closing back to back could both read the
  // flow as "not rate-limited yet" and both deliver (check-then-set race).
  const now = Date.now();
  let claimed = false;
  let fires = flow.fires;
  let prevFires = flow.fires;
  let prevLastFiredAt = flow.lastFiredAt;
  let prevFailStreak = flow.failStreak ?? 0;
  await updateBoard((b) => {
    const r = claimFlowFire(b, flow.id, now, FLOW_RATE_LIMIT_MS, backoffMs);
    claimed = r.claimed;
    prevFires = r.prevFires;
    prevLastFiredAt = r.prevLastFiredAt;
    prevFailStreak = r.prevFailStreak;
    if (claimed) fires = r.board.flows.find((f) => f.id === flow.id)?.fires ?? fires;
    return r.board;
  });
  if (!claimed) return; // already fired, disabled, removed, cooling down, or backed off

  const ref = flow.to.slice(2);
  let delivered = false;
  let runKey: string | undefined;
  let areaBlocked: AreaId | undefined;
  // A throw after the claim (a board read rejecting, a spawn failing) used to skip
  // the failure branch below: fires/lastFiredAt stayed advanced with no failure
  // streak, no backoff and no toast. It is a failed delivery like any other.
  try {
    if (flow.to.startsWith('s:')) {
      const r = await deliverToSession(ref, buildFlowPrompt(flow, result, hop), params, flow, hop);
      delivered = r.delivered;
      areaBlocked = r.areaBlocked;
    } else {
      const r = await deliverToCard(ref, flow, result, hop, params);
      delivered = r.delivered;
      runKey = r.runKey;
      areaBlocked = r.areaBlocked;
    }
  } catch (e) {
    console.error(`canvas flow ${flow.id}: delivery threw:`, (e as Error).message);
    delivered = false;
  }

  if (!delivered) {
    // Restore the EXACT prior fires/lastFiredAt (not just cleared) and arm
    // the exponential backoff for the next attempt — a flow that keeps
    // failing must wait longer each time, not retry on every source close.
    // A block on the target's own AREA gets a much shorter cap
    // (AREA_BLOCKED_BACKOFF_MAX_MS): the area is expected to recover in
    // minutes, unlike a genuinely dead target.
    await updateBoard((b) => recordFlowFailure(b, flow.id, now, prevFires, prevLastFiredAt, now, !!areaBlocked));
    if (prevFailStreak === 0) {
      // One toast for the START of a failure streak, not one per source turn
      // that closes while this flow keeps failing — that would spam.
      // ADMIN-ONLY, dedicated frame — never the generic keyless {t:'error'}:
      // every tab's onMsg treats that as "the active turn/handoff broke"
      // (src/useCockpit.ts calls endHandoff() unconditionally, and
      // src/cockpit/useCanvas.ts marks the canvas stale if one lands mid a
      // canvas-get) — both wrong for a background flow failure.
      //
      // Area-blocked gets its OWN message (review: the generic "não
      // conseguiu entregar" reads as a broken target, not a budget the user
      // set on purpose) — never confused with a dead session/card.
      const message = areaBlocked
        ? `Fluxo do canvas segurado: área ${AREA_LABELS[areaBlocked]} está acima do orçamento — retoma sozinho quando ela normalizar.`
        : `Fluxo do canvas não conseguiu entregar em ${flow.to} — vai tentar de novo com espera crescente.`;
      emitCanvasMsg({ t: 'canvas-flow-failed', flowId: flow.id, message });
    }
    console.error(`canvas flow ${flow.id}: delivery to ${flow.to} failed (streak ${prevFailStreak + 1}${areaBlocked ? `, área ${areaBlocked} bloqueada` : ''})`);
    return;
  }

  if (prevFailStreak > 0) await updateBoard((b) => recordFlowSuccess(b, flow.id));
  // Only now, after a REAL delivery, does the UI learn the flow fired — a
  // pulse/counter bump for a claim whose delivery never happened would lie
  // (and did, before this fix: the broadcast used to fire right after the
  // claim, ahead of the delivery attempt).
  emitCanvasMsg({ t: 'canvas-flow-fired', flowId: flow.id, at: now, fires });
  // Card targets start a session the browser never asked for — without this,
  // the kanban has no way to know it's running (or to stop it) until the
  // session shows up in the next natural sessions-list/graph refresh.
  if (runKey) emitCanvasMsg({ t: 'canvas-flow-run', flowId: flow.id, runKey, cardId: ref });
}

export async function handleTurnClosed(t: TurnClosed): Promise<void> {
  try {
    // Unconditional, before the ok/unattended gate below: whatever turn just
    // closed under this sessionKey is OVER either way (clean, stopped, or
    // crashed) — if it was a card-target flow run, it's no longer live.
    clearFlowRun(t.sessionKey);
    if (!t.ok || t.unattended) return;
    // Cheap (no IO): warm the marker-based session→card binding on EVERY
    // clean close, not only once the board already has flows — a flow drawn
    // LATER needs this map already warm, since the marker only ever appears
    // on the session's first turn (this covers the client's own runCard
    // launches too, which reach here exactly the same way).
    const marker = lastCardMarker(t.prompt);
    if (marker && t.sessionId) bindCardSession(t.sessionId, marker);

    const board = await readBoardChained();
    if (!board.flows.length) return;

    // Disk fallback only matters once there's something to match against —
    // gated here (not above) to skip that IO entirely for the common case of
    // a user with no flows configured yet.
    let boundCardId = marker ?? (t.sessionId ? cardIdForSession(t.sessionId) : undefined);
    if (!boundCardId && t.sessionId) {
      boundCardId = await cardIdFromRefsCache(t.sessionId);
      if (boundCardId) bindCardSession(t.sessionId, boundCardId);
    }
    const fires = selectFlowsToFire(
      { ok: t.ok, sessionId: t.sessionId, prompt: t.prompt, unattended: t.unattended, hop: t.hop, boundCardId },
      board.flows, Date.now(),
    );
    if (!fires.length) return;
    const result = flowResult(t.text);
    // Sequential on purpose: each fire persists a board write (claimFlowFire),
    // and updateBoard's own chain would just serialize them anyway.
    for (const { flow, hop } of fires) await fireFlow(flow, hop, result, t.params);
  } catch (e) {
    console.error('canvas flow trigger failed', e);
  }
}

let registered = false;
// Idempotent: dispatch.ts calls this at module scope so both entry points
// (server/index.ts and server/agent.ts, which both reach it through
// server/ws/serve-connection.ts) register exactly once even if re-imported.
export function startCanvasFlows(): void {
  if (registered) return;
  registered = true;
  onTurnClosed((t) => { void handleTurnClosed(t); });
}
