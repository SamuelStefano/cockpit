import { randomUUID } from 'node:crypto';
import {
  DEFAULT_FLOW_TEMPLATE, FLOW_MARKER_RE, cardNodeId, flowMarker, sessionNodeId,
  type CanvasFlow, type CanvasNode, type ContentFormat,
} from '../../shared/canvas';
import { buildContentPrompt, buildTaskPrompt } from '../../shared/canvas-prompt';
import { listContexts } from '../contexts';
import { listArchived, listSessions } from '../sessions/index';
import { emitCanvasMsg } from '../ws/canvas-clients';
import { enqueuePending } from '../ws/pending';
import { addParked } from '../ws/parked';
import { resumableId } from '../ws/resume';
import { isDrainerEnabled, startRun } from '../ws/runs';
import { resolveThreadKey, threads, type RunParams } from '../ws/threads';
import { bindCardSession, cardIdForSession, lastCardMarker, neutralizeMarkers } from './card-sessions';
import { cardIdFromRefsCache } from './index';
import { claimFlowFire, markCardDoing, readBoardChained, recordFlowFailure, recordFlowSuccess, updateBoard } from './board';
import { clearFlowRun, registerFlowRun } from './flow-runs';
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

export function backoffMs(failStreak: number): number {
  if (failStreak <= 0) return 0;
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failStreak - 1));
}

export function backedOff(flow: Pick<CanvasFlow, 'failStreak' | 'lastFailedAt'>, now: number): boolean {
  if (!flow.failStreak || flow.lastFailedAt === undefined) return false;
  return now - flow.lastFailedAt < backoffMs(flow.failStreak);
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

// Target `s:<uuid>`: continue the existing session. Delivery only counts once
// a thread actually admitted (threads.get after the call — same check
// runParkedInBackground uses at server/ws/runs.ts around admitRun): a
// concurrency-cap rejection, a hard-context block, or an invalid sessionKey
// all return from startRun/addParked/enqueuePending having done nothing.
export async function deliverToSession(sessionId: string, prompt: string, source: RunParams, flow: CanvasFlow, hop: number): Promise<boolean> {
  const resume = resumableId(sessionId);
  if (!resume) return false; // transcript gone — nothing to continue
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
      return !('reject' in r);
    }
    return enqueuePending(liveKey, { ...params, ws: null, prompt, merge: false });
  }
  startRun({ ws: null, sessionKey: resume, prompt, resumeId: resume, flowHop: hop, ...params });
  return threads.has(resume);
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

export interface CardDelivery { delivered: boolean; runKey?: string }

// Target `k:<cardId>`: run the card as a brand new session, same prompt shape
// runCard builds client-side (buildTaskPrompt/buildContentPrompt, which end
// with the card marker), prefixed with the flow's template applied to the
// result. Key is `new-<uuid>`, not a bare uuid: that's the exact prefix
// src/useCockpit.ts's migrateKey looks for on 'done' to fold the placeholder
// into the real session id — a bare uuid key has no such reconciliation and
// would leave an orphan bubble no sidebar entry ever matches.
export async function deliverToCard(cardId: string, flow: CanvasFlow, result: string, hop: number, source: RunParams): Promise<CardDelivery> {
  const board = await readBoardChained();
  const card = board.cards.find((c) => c.id === cardId);
  if (!card) return { delivered: false };
  const { contexts, sessions } = await resolveCardNodes(card.contextIds, card.sessionIds);
  const basePrompt = card.kind === 'content'
    ? buildContentPrompt(card, (card.format ?? 'post') as ContentFormat, contexts, sessions, today())
    : buildTaskPrompt(card, contexts, sessions);
  const prompt = `${fillTemplate(flow.template, result)}\n\n${basePrompt}\n\n${flowMarker(flow.id, hop)}`;
  const sessionKey = `new-${randomUUID()}`;
  startRun({ ws: null, sessionKey, prompt, flowHop: hop, ...safeParams(source, flow) });
  if (!threads.has(sessionKey)) return { delivered: false }; // admission refused (concurrency cap, ctx gate, ...): nothing started
  await updateBoard((b) => markCardDoing(b, cardId, Date.now()));
  // Live until handleTurnClosed sees this exact sessionKey close (below) —
  // read back by server/ws/dispatch.ts on every canvas-board answer, so a
  // tab that (re)connects mid-run still sees the card running.
  registerFlowRun(sessionKey, cardId, flow.id);
  return { delivered: true, runKey: sessionKey };
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
  if (flow.to.startsWith('s:')) {
    delivered = await deliverToSession(ref, buildFlowPrompt(flow, result, hop), params, flow, hop);
  } else {
    const r = await deliverToCard(ref, flow, result, hop, params);
    delivered = r.delivered;
    runKey = r.runKey;
  }

  if (!delivered) {
    // Restore the EXACT prior fires/lastFiredAt (not just cleared) and arm
    // the exponential backoff for the next attempt — a flow that keeps
    // failing must wait longer each time, not retry on every source close.
    await updateBoard((b) => recordFlowFailure(b, flow.id, now, prevFires, prevLastFiredAt, now));
    if (prevFailStreak === 0) {
      // One toast for the START of a failure streak, not one per source turn
      // that closes while this flow keeps failing — that would spam.
      // ADMIN-ONLY, dedicated frame — never the generic keyless {t:'error'}:
      // every tab's onMsg treats that as "the active turn/handoff broke"
      // (src/useCockpit.ts calls endHandoff() unconditionally, and
      // src/cockpit/useCanvas.ts marks the canvas stale if one lands mid a
      // canvas-get) — both wrong for a background flow failure.
      emitCanvasMsg({ t: 'canvas-flow-failed', flowId: flow.id, message: `Fluxo do canvas não conseguiu entregar em ${flow.to} — vai tentar de novo com espera crescente.` });
    }
    console.error(`canvas flow ${flow.id}: delivery to ${flow.to} failed (streak ${prevFailStreak + 1})`);
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
