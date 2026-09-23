import { randomUUID } from 'node:crypto';
import {
  CARD_MARKER_RE, DEFAULT_FLOW_TEMPLATE, FLOW_MARKER_RE, cardNodeId, flowMarker, sessionNodeId,
  type CanvasFlow, type CanvasNode, type ContentFormat,
} from '../../shared/canvas';
import { buildContentPrompt, buildTaskPrompt } from '../../shared/canvas-prompt';
import { broadcast } from '../ws/broadcast';
import { addParked } from '../ws/parked';
import { resumableId } from '../ws/resume';
import { startRun } from '../ws/runs';
import { resolveThreadKey, type RunParams } from '../ws/threads';
import { bumpFlowFired, markCardDoing, readBoardChained, updateBoard } from './board';
import { buildCanvas } from './index';
import { onTurnClosed, type TurnClosed } from './turn-hooks';

// The orchestrator: when a turn closes ok, whatever flows start at its
// session (or at the card it was bound to) fire, delivering the turn's text
// as the next prompt. Fires with the browser closed — this listens on
// onTurnClosed (server/canvas/turn-hooks.ts), which server/ws/runs.ts emits
// once per turn close regardless of whether a client is attached.

// Never let a chain run away: hop N+1 is blocked once N would reach this.
export const MAX_HOPS = 5;
// Same flow can't refire within this window — a fast back-and-forth pair of
// flows would otherwise ping-pong every turn close forever (until MAX_HOPS).
export const FLOW_RATE_LIMIT_MS = 60_000;
// The prompt only needs the TAIL of a long result — keeps the target turn's
// input bounded no matter how long the source ran.
export const MAX_RESULT_CHARS = 12_000;

// --- pure: what fires, at what hop, with what text --------------------------

export function hopOfPrompt(prompt: string): number {
  const m = FLOW_MARKER_RE.exec(prompt);
  if (!m) return 0;
  const hop = Number(m[2]);
  return Number.isFinite(hop) && hop >= 0 ? hop : 0;
}

export function rateLimited(flow: Pick<CanvasFlow, 'lastFiredAt'>, now: number): boolean {
  return !!flow.lastFiredAt && now - flow.lastFiredAt < FLOW_RATE_LIMIT_MS;
}

export function flowResult(text: string): string {
  return text.length > MAX_RESULT_CHARS ? text.slice(text.length - MAX_RESULT_CHARS) : text;
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

export interface FlowFire { flow: CanvasFlow; hop: number }

// Only a turn that finished cleanly (ok) can fire anything — a stopped turn,
// a silent death or a pending AskUserQuestion produced no real result to hand
// forward. Source matching: the session that just closed, plus — when the
// prompt carries the card marker — the card that session ran for.
export function selectFlowsToFire(t: Pick<TurnClosed, 'ok' | 'sessionId' | 'prompt'>, flows: CanvasFlow[], now: number): FlowFire[] {
  if (!t.ok) return [];
  const hop = hopOfPrompt(t.prompt) + 1;
  if (hop >= MAX_HOPS) return [];
  const sources = new Set<string>();
  if (t.sessionId) sources.add(sessionNodeId(t.sessionId));
  const cardMatch = CARD_MARKER_RE.exec(t.prompt);
  if (cardMatch) sources.add(cardNodeId(cardMatch[1]));
  if (!sources.size) return [];
  return flows
    .filter((f) => f.enabled && sources.has(f.from) && !rateLimited(f, now))
    .map((flow) => ({ flow, hop }));
}

// --- impure: actually deliver the prompt -------------------------------------

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

// Only the fields the drainer/startRun accept — RunParams also carries
// allowWorkflow, which ParkedItem has no slot for.
function parkedParams(p: RunParams) {
  return {
    mode: p.mode, model: p.model, maxBudgetUsd: p.maxBudgetUsd, bypass: p.bypass, role: p.role,
    disallowedSkills: p.disallowedSkills, mcps: p.mcps, effort: p.effort,
  };
}

// Target `s:<uuid>`: continue the existing session. A live run queues behind
// it (addParked, same path queue-add uses); an idle one resumes directly,
// same shape as fireCron/autoResume (ws: null — the stream still broadcasts).
async function deliverToSession(sessionId: string, prompt: string, params: RunParams): Promise<boolean> {
  const resume = resumableId(sessionId);
  if (!resume) return false; // transcript gone — nothing to continue
  const liveKey = resolveThreadKey(sessionId);
  if (liveKey) {
    const r = addParked(liveKey, { ...parkedParams(params), prompt, resumeId: resume });
    return !('reject' in r);
  }
  startRun({ ws: null, sessionKey: resume, prompt, resumeId: resume, ...parkedParams(params) });
  return true;
}

// Target `k:<cardId>`: run the card as a brand new session, same prompt shape
// runCard builds client-side (buildTaskPrompt/buildContentPrompt, which end
// with the card marker), prefixed with the flow's template applied to the
// result. Fresh server-chosen key, same pattern as fireCron's `cron-<id>` —
// here randomUUID() since, unlike a cron, each fire is its own new session.
async function deliverToCard(cardId: string, flow: CanvasFlow, result: string, hop: number, params: RunParams): Promise<boolean> {
  const board = await readBoardChained();
  const card = board.cards.find((c) => c.id === cardId);
  if (!card) return false;
  const graph = await buildCanvas(board);
  const byId = new Map<string, CanvasNode>(graph.nodes.map((n) => [n.id, n]));
  const contexts = card.contextIds.map((id) => byId.get(`c:${id}`)).filter((n): n is CanvasNode => !!n);
  const sessions = card.sessionIds.map((id) => byId.get(`s:${id}`)).filter((n): n is CanvasNode => !!n);
  const basePrompt = card.kind === 'content'
    ? buildContentPrompt(card, (card.format ?? 'post') as ContentFormat, contexts, sessions, today())
    : buildTaskPrompt(card, contexts, sessions);
  const prompt = `${fillTemplate(flow.template, result)}\n\n${basePrompt}\n\n${flowMarker(flow.id, hop)}`;
  startRun({ ws: null, sessionKey: randomUUID(), prompt, ...parkedParams(params) });
  await updateBoard((b) => markCardDoing(b, cardId, Date.now()));
  return true;
}

async function fireFlow(flow: CanvasFlow, hop: number, result: string, params: RunParams): Promise<void> {
  const ref = flow.to.slice(2);
  const delivered = flow.to.startsWith('s:')
    ? await deliverToSession(ref, buildFlowPrompt(flow, result, hop), params)
    : await deliverToCard(ref, flow, result, hop, params);
  if (!delivered) {
    console.error(`canvas flow ${flow.id}: target ${flow.to} not found, skipped`);
    return;
  }
  const board = await updateBoard((b) => bumpFlowFired(b, flow.id, Date.now()));
  broadcast({ t: 'canvas-flow-fired', flowId: flow.id, at: Date.now() });
  broadcast({ t: 'canvas-board', board });
}

async function handleTurnClosed(t: TurnClosed): Promise<void> {
  try {
    const board = await readBoardChained();
    const fires = selectFlowsToFire(t, board.flows, Date.now());
    if (!fires.length) return;
    const result = flowResult(t.text);
    // Sequential on purpose: each fire persists a board write (bumpFlowFired),
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
