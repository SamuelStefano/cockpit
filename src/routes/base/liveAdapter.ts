import type { Message, ToolQuestion } from '../../data/types';
import type { CanvasCard, CardStatus, TermStats } from '../../../shared/canvas';
import { isCronPing } from '../../../shared/canvas';
import type { Cron, SysStats } from '../../../shared/protocol';
import { pendingQuestionIdx } from '../../cockpit/pending-question';
import { lastAssistantModel } from '../../cockpit/session-model';
import { isFreeTextOption } from '../../components/chat/free-text-option';
import { parseRecommended } from '../../components/chat/recommended';
import { ctxPct, shortModel } from '../canvas/term-stats-view';
import { layoutWings, sectorRows, slotPosition } from './sectors';
import type { AgentState, Decision, Floor, FloorAgent, FloorCrate, ModelFamily, SectorRow, Station, Wing } from './types';

export const LIVE_AGENT_CAP = 18;
export const RECENT_MS = 2 * 3600 * 1000;
export const FINISHED_MS = 30 * 60 * 1000;
const IDLE_CAP = 6;
export const CONTEXT_ALERT = 80;
const MAX_CRATES_PER_STATUS = 8;

export interface LiveSession { id: string; title: string; mtime: number; waiting?: boolean }
export interface LiveInput {
  sessions: LiveSession[];
  running: ReadonlySet<string>;
  termStats: Record<string, Partial<TermStats> | undefined>;
  threads: Record<string, Message[] | undefined>;
  tails: Record<string, string | null | undefined>;
  teamQuestions: { sessionKey: string; questions: ToolQuestion[] }[];
  areas: Record<string, string | undefined>;
  cards: CanvasCard[] | null;
  stats: SysStats | null;
  crons: Cron[] | null;
  mcpServers: number | null;
  answered: Record<string, number>;
  now: number;
}

export interface Placement { order: string[]; slots: Record<string, Record<string, number>> }
export const emptyPlacement = (): Placement => ({ order: [], slots: {} });

export type LiveAction = { kind: 'answer'; sessionId: string; text: string } | { kind: 'open'; sessionId: string };
export interface LiveDecision extends Decision { actions: LiveAction[] }

export interface LiveFloor { floor: Floor; decisions: LiveDecision[]; elsewhere: number; awaiting: number; sectors: SectorRow[]; placement: Placement; missingThreads: string[]; shown: string[] }

export function familyOf(model: string | null | undefined): ModelFamily {
  const m = (model ?? '').toLowerCase();
  if (m.includes('opus')) return 'opus';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('grok')) return 'grok';
  if (m.includes('codex') || m.includes('gpt')) return 'codex';
  return 'unknown';
}

const PREFIX_RE = /^\s*\[?([\p{L}][\p{L}\p{N}._-]{1,20})\]?\s*(?::|\s[-–—/]\s|\])/u;
const GENERIC_AREA = /^(outros?|others?|general|geral|misc)$/i;
const KEYWORDS: [RegExp, string][] = [[/\bitera/i, 'Itera'], [/\b(deck|cockpit|deckctl|canvas|relay|kanban)\b/i, 'Deck'], [/\bgrok/i, 'Grok'], [/\b(reel|post|carrossel|linkedin|campaigns?)\b/i, 'Content'], [/\bsupabase\b/i, 'Supabase']];
const wingOf_ = (name: string) => ({ id: name.toLowerCase(), name: name[0].toUpperCase() + name.slice(1) });

export function projectOf(title: string, area?: string): { id: string; name: string } {
  if (area && !GENERIC_AREA.test(area)) return wingOf_(area);
  const prefix = PREFIX_RE.exec(title)?.[1];
  if (prefix && !GENERIC_AREA.test(prefix)) return wingOf_(prefix);
  const hit = KEYWORDS.find(([re]) => re.test(title));
  return hit ? wingOf_(hit[1]) : { id: 'general', name: 'General' };
}

export function pickSessions(input: Pick<LiveInput, 'sessions' | 'running' | 'now'>): { shown: LiveSession[]; elsewhere: number } {
  const live = input.sessions.filter((s) => !isCronPing(s));
  const active = (s: LiveSession) => input.running.has(s.id) || !!s.waiting;
  const hot = live.filter(active).sort((a, b) => b.mtime - a.mtime);
  // Idle desks are context, not news: a few recent ones, so running work stays the loudest thing on the floor.
  const recent = live.filter((s) => !active(s) && input.now - s.mtime < RECENT_MS).sort((a, b) => b.mtime - a.mtime).slice(0, IDLE_CAP);
  const all = [...hot, ...recent];
  return { shown: all.slice(0, LIVE_AGENT_CAP), elsewhere: Math.max(0, live.filter((s) => active(s) || input.now - s.mtime < RECENT_MS).length - Math.min(all.length, LIVE_AGENT_CAP)) };
}

// An agent keeps its desk while it stays on the floor: wings stay in first-seen order and a slot
// is only reused once its session has left.
export function placeSessions(prev: Placement, shown: { id: string; project: string }[]): Placement {
  const order = [...prev.order], slots: Placement['slots'] = {};
  for (const s of shown) {
    if (!order.includes(s.project)) order.push(s.project);
    slots[s.project] ??= {};
    const before = prev.slots[s.project]?.[s.id];
    if (before !== undefined) slots[s.project][s.id] = before;
  }
  for (const s of shown) {
    const mine = slots[s.project];
    if (mine[s.id] !== undefined) continue;
    const taken = new Set(Object.values(mine));
    let free = 0;
    while (taken.has(free)) free++;
    mine[s.id] = free;
  }
  return { order: order.filter((p) => slots[p]), slots };
}

function questionFor(id: string, input: LiveInput): ToolQuestion[] | null {
  const bot = input.teamQuestions.find((q) => q.sessionKey === id);
  if (bot) return bot.questions;
  const thread = input.threads[id];
  if (!thread) return null;
  const idx = pendingQuestionIdx(thread);
  if (idx < 0) return null;
  const m = thread[idx];
  if (m.role !== 'assistant') return null;
  for (const b of m.blocks) if (b.type === 'tool' && b.tool.name === 'AskUserQuestion' && b.tool.questions?.length) return b.tool.questions;
  return null;
}

function questionDecision(s: LiveSession, input: LiveInput, pos: { x: number; z: number }, agentId: string): LiveDecision {
  const qs = questionFor(s.id, input), open: LiveAction = { kind: 'open', sessionId: s.id };
  const base = { id: `q-${s.id}-${s.mtime}`, type: 'question', title: s.title || 'Untitled session', born: s.mtime, pos, focusAgentId: agentId };
  const simple = qs?.length === 1 && !qs[0].multiSelect ? qs[0] : null;
  if (!simple) {
    return { ...base, what: qs?.[0]?.question ?? 'The question has not loaded on this client.', why: qs ? 'Several answers: reply from the chat.' : 'Question text unknown.', opts: [{ label: 'Open chat', hint: 'answer there', rec: true }], actions: [open] };
  }
  const options = simple.options.map((o) => ({ ...parseRecommended(o.label), description: o.description }));
  const actions: LiveAction[] = options.map((o) => (isFreeTextOption(o.label) ? open : { kind: 'answer', sessionId: s.id, text: o.label }));
  return {
    ...base, what: simple.question, why: 'Awaiting your answer',
    opts: [...options.map((o) => ({ label: o.label, hint: isFreeTextOption(o.label) ? 'write it in the chat' : (o.description ?? '').slice(0, 60), rec: o.recommended })), { label: 'Open chat', hint: 'see the context' }],
    actions: [...actions, open],
  };
}

const stationsLive: Station[] = [
  { id: 'todo', label: 'TODO', x: -28 }, { id: 'doing', label: 'DOING', x: -4 }, { id: 'review', label: 'REVIEW', x: 20 }, { id: 'done', label: 'DONE', x: 44 },
];

// Card crates sit parked at their real status. Nothing moves, because the client has no transition to show.
function cardCrates(cards: CanvasCard[] | null): FloorCrate[] {
  if (!cards) return [];
  const out: FloorCrate[] = [];
  for (const st of stationsLive) {
    const mine = cards.filter((c) => c.status === (st.id as CardStatus)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CRATES_PER_STATUS);
    mine.forEach((c, i) => out.push({ id: `card-${c.id}`, title: c.title, x: st.x - 2.2 - (i % 4) * 1.5, y: 0.75, z: 8 + Math.floor(i / 4) * 1.9, star: st.id === 'done' }));
  }
  return out;
}

export function nextCronRun(c: Cron, now: number): number | null {
  if (!c.enabled) return null;
  const s = c.schedule;
  if (s.kind === 'once') return s.atMs && s.atMs > now ? s.atMs : null;
  if (s.kind === 'interval' && s.everyMinutes) return Math.max(now, (c.lastRun ?? c.createdAt) + s.everyMinutes * 60000);
  if (s.kind === 'daily' && s.atMinute !== undefined) {
    const d = new Date(now);
    d.setHours(0, s.atMinute, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return null;
}

function clockLabel(crons: Cron[] | null, now: number): string {
  if (!crons) return 'NEXT RUN UNKNOWN';
  const next = crons.map((c) => nextCronRun(c, now)).filter((t): t is number => t !== null).sort((a, b) => a - b)[0];
  if (!next) return 'NO RUN SCHEDULED';
  const d = new Date(next);
  return `NEXT RUN ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function adaptLive(input: LiveInput, prev: Placement): LiveFloor {
  const { shown, elsewhere } = pickSessions(input);
  const withProject = shown.map((s) => ({ s, p: projectOf(s.title, input.areas[s.id]) }));
  const placement = placeSessions(prev, withProject.map(({ s, p }) => ({ id: s.id, project: p.id })));
  const names = Object.fromEntries(withProject.map(({ p }) => [p.id, p.name]));
  // A wing is as wide as its highest slot, not its head count, so nobody slides when a neighbor leaves.
  const groups = placement.order.map((id) => ({ id, name: names[id], count: Math.max(...Object.values(placement.slots[id])) + 1 }));
  const { wings, folded } = layoutWings(groups);
  const wingOf = (project: string): Wing => wings.find((w) => w.id === (folded[project] ?? project)) ?? wings[0];

  const otherSlots = new Map<string, number>();
  const decisions: LiveDecision[] = [], missingThreads: string[] = [];
  const agents = withProject.map(({ s, p }, idx): FloorAgent => {
    const wing = wingOf(p.id);
    let slot = placement.slots[p.id][s.id];
    if (folded[p.id]) { slot = otherSlots.get(wing.id) ?? 0; otherSlots.set(wing.id, slot + 1); }
    const pos = slotPosition(wing, slot);
    const stat = input.termStats[s.id], thread = input.threads[s.id];
    const model = stat?.model ?? lastAssistantModel(thread);
    const pct = stat?.contextTokens ? ctxPct({ contextTokens: stat.contextTokens, model: stat.model }) : null;
    const isRunning = input.running.has(s.id);
    const asking = !!s.waiting && input.answered[s.id] !== s.mtime;
    const finished = !asking && !isRunning && input.now - s.mtime < FINISHED_MS;
    const state: AgentState = asking ? 'blocked' : isRunning ? 'working' : finished ? 'finished' : 'waiting';
    const id = `s-${s.id}`;
    if (asking) {
      decisions.push(questionDecision(s, input, pos, id));
      if (!thread && !input.teamQuestions.some((q) => q.sessionKey === s.id)) missingThreads.push(s.id);
    } else if (pct !== null && pct >= CONTEXT_ALERT) {
      decisions.push({ id: `ctx-${s.id}`, type: 'context', title: s.title || 'Untitled session', what: `Context at ${pct}%`, why: 'Hand off from the chat', born: stat?.lastAt ?? s.mtime, pos, focusAgentId: id, opts: [{ label: 'Open chat', hint: 'hand off there', rec: true }], actions: [{ kind: 'open', sessionId: s.id }] });
    }
    const now = asking ? 'Waiting for your answer' : isRunning ? 'Running a turn' : finished ? `Finished ${Math.max(1, Math.round((input.now - s.mtime) / 60000))}m ago, read it` : 'Idle';
    return {
      id, name: s.title || 'Untitled session', family: familyOf(model), modelLabel: model ? shortModel(model) : 'unknown', wingId: wing.id, sector: 'build', x: pos.x, z: pos.z, state,
      line: now, sessionId: s.id, ctx: pct === null ? null : pct / 100, phase: idx * 1.7,
      monitor: { kind: 'live', title: s.title || 'Untitled session', tail: input.tails[s.id] ?? null, now },
    };
  });

  const count = (st: CardStatus) => input.cards?.filter((c) => c.status === st).length ?? 0;
  const review = count('review'), done = count('done');
  const disk = input.stats?.disk.total ? input.stats.disk.used / input.stats.disk.total : null;
  const floor: Floor = {
    agents, wings, packets: [], arcs: [], crates: cardCrates(input.cards),
    stations: stationsLive.map((st) => ({ ...st, label: input.cards ? `${st.label} ${count(st.id as CardStatus)}` : st.label })),
    mountainCount: review,
    mountainLabel: input.cards ? `${review} CARDS IN REVIEW · ${done} DONE` : 'BOARD NOT LOADED',
    gateBarsUp: false, machineOk: null, machineSpin: false,
    machineLabel: input.mcpServers === null ? 'MCP: UNKNOWN' : `MCP: ${input.mcpServers} SERVERS`,
    racks: [{ name: 'THIS BOX', disk, label: disk === null ? 'THIS BOX · DISK ?' : `THIS BOX · DISK ${Math.round(disk * 100)}%` }],
    clockLabel: clockLabel(input.crons, input.now), postBoard: null, beltMoving: false,
  };
  const sectors = sectorRows(agents, { ship: { busy: count('doing'), waiting: count('todo') }, archive: { waiting: review } });
  decisions.sort((a, b) => Number(b.type === 'question') - Number(a.type === 'question') || b.born - a.born);
  const awaiting = decisions.length;
  return { floor, decisions, elsewhere, awaiting, sectors, placement, missingThreads, shown: shown.map((s) => s.id) };
}
