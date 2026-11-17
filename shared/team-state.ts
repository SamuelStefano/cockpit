import type { TeamBot } from './protocol';
import type { PlannerTask } from './planner';
import type { DepartmentId } from './departments';
import type { TeamMessage } from './team-messages';

export const TEAM_STATE_PREVIEW = 120;
export const TEAM_STATE_FEED_CAP = 30;
export const DEFAULT_FOLLOW_UP_HOURS = 4;
const HOUR_MS = 3_600_000;

export type TeamBotStatus = 'working' | 'idle' | 'waiting';

export interface TeamStateSend { to: string; at: number; preview: string }
export interface TeamStateBot {
  id: string;
  name: string;
  role: string;
  sector?: DepartmentId;
  manager?: string;
  status: TeamBotStatus;
  task?: string;
  lastSend?: TeamStateSend;
}
export interface TeamStateHandoff { from?: string; to: string; point: string; at: number; taskId: string }
export interface TeamStateFollowUp { from: string; to: string; at: number; preview: string }
export interface TeamState {
  at: number;
  followUpHours: number;
  bots: TeamStateBot[];
  handoffs: TeamStateHandoff[];
  followUps: TeamStateFollowUp[];
}

export interface TeamStateInput {
  team: TeamBot[];
  tasks: PlannerTask[];
  log: TeamMessage[];
  running: ReadonlySet<string>;
  waiting: ReadonlySet<string>;
  now: number;
  followUpHours?: number;
}

const preview = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, TEAM_STATE_PREVIEW);
const sent = (m: TeamMessage): boolean => m.status === 'delivered' || m.status === 'queued';

export function followUpHoursOf(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 24 * 30 ? n : DEFAULT_FOLLOW_UP_HOURS;
}

// The task a bot is on: its open owned task, the nearest-to-today column first.
export function currentTask(botId: string, tasks: PlannerTask[]): PlannerTask | undefined {
  const rank = { today: 0, week: 1, backlog: 2, done: 3 } as const;
  return tasks
    .filter((t) => t.ownerBotId === botId && t.column !== 'done')
    .sort((a, b) => rank[a.column] - rank[b.column] || a.order - b.order)[0];
}

// A request is a message that reached (or is queued for) the recipient and has not
// been answered since: no later message from the recipient back to the sender. It
// becomes a follow-up once it is older than `hours`.
export function pendingFollowUps(log: TeamMessage[], team: Pick<TeamBot, 'id'>[], now: number, hours: number): TeamStateFollowUp[] {
  const known = new Set(team.map((b) => b.id));
  const out: TeamStateFollowUp[] = [];
  for (const m of log) {
    if (!sent(m) || !known.has(m.from) || !known.has(m.to) || now - m.ts < hours * HOUR_MS) continue;
    if (log.some((r) => sent(r) && r.from === m.to && r.to === m.from && r.ts > m.ts)) continue;
    out.push({ from: m.from, to: m.to, at: m.ts, preview: preview(m.text) });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, TEAM_STATE_FEED_CAP);
}

export function buildTeamState(i: TeamStateInput): TeamState {
  const ids = new Set(i.team.map((b) => b.id));
  const lastSend = new Map<string, TeamMessage>();
  for (const m of i.log) {
    if (!sent(m)) continue;
    const prev = lastSend.get(m.from);
    if (!prev || prev.ts <= m.ts) lastSend.set(m.from, m);
  }
  const bots = i.team.map((b): TeamStateBot => {
    const task = currentTask(b.id, i.tasks);
    const last = lastSend.get(b.id);
    return {
      id: b.id,
      name: b.name,
      role: b.label,
      ...(b.department ? { sector: b.department } : {}),
      ...(b.parentId && ids.has(b.parentId) ? { manager: b.parentId } : {}),
      status: i.waiting.has(b.id) ? 'waiting' : i.running.has(b.id) ? 'working' : 'idle',
      ...(task ? { task: task.title } : {}),
      ...(last ? { lastSend: { to: last.to, at: last.ts, preview: preview(last.text) } } : {}),
    };
  });
  const handoffs: TeamStateHandoff[] = [];
  for (const t of i.tasks) {
    for (const h of t.handoffs ?? []) {
      handoffs.push({ ...(h.fromBotId ? { from: h.fromBotId } : {}), to: h.toBotId, point: preview(h.switchPoint), at: h.at, taskId: t.id });
    }
  }
  handoffs.sort((a, b) => b.at - a.at);
  const hours = i.followUpHours ?? DEFAULT_FOLLOW_UP_HOURS;
  return { at: i.now, followUpHours: hours, bots, handoffs: handoffs.slice(0, TEAM_STATE_FEED_CAP), followUps: pendingFollowUps(i.log, i.team, i.now, hours) };
}
