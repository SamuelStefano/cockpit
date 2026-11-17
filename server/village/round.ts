import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TeamBot } from '../../shared/protocol';
import { PLANNER_LIMITS, type PlannerTask } from '../../shared/planner';
import type { TeamMessage } from '../../shared/team-messages';
import { VILLAGE_DEFAULT_DAILY_CAP, type VillageState } from '../../shared/village';
import { readTasksChained, updateTasks } from '../planner/store';
import { getTeam } from '../team';
import { isTeamPaused, readTeamLog, teamOutboxDir } from '../team-log';
import { addTurn, readVillage, recordEvent, turnsToday, updateVillage } from './store';

export const CLAIM_STALE_MS = 30 * 60_000;
const COLUMN_RANK = { today: 0, week: 1, backlog: 2, done: 3 } as const;
const MESSAGE_DESC_MAX = 3000;

const UNSAFE_WORDS = [
  'prod(?:uction|ução|ucao)?', 'banco', 'database', 'migration', 'rls', 'supabase', 'dinheiro', 'financeiro',
  'money', 'payment', 'invoice', 'irrevers[ií]vel', 'irreversible', 'delet(?:e|ed|es|ing|ion)', 'drop(?:ped|ping)?',
  'rm\\s+-rf', 'secret', 'token', 'credential',
];
export const UNSAFE_NET = new RegExp(`(?<![\\p{L}\\p{N}])(?:${UNSAFE_WORDS.join('|')})s?(?![\\p{L}\\p{N}])`, 'iu');

export function matchesUnsafeNet(task: Pick<PlannerTask, 'title' | 'description'>): boolean {
  return UNSAFE_NET.test(`${task.title}\n${task.description}`);
}

export interface RoundConfig { dailyCap: number }
export interface RoundClaim { taskId: string; botId: string }
export interface RoundRelease { taskId: string; botId: string; reason: string }
export interface RoundPlan { claims: RoundClaim[]; releases: RoundRelease[] }

export interface RoundInput {
  tasks: PlannerTask[];
  team: Pick<TeamBot, 'id' | 'department' | 'primary'>[];
  state: Pick<VillageState, 'turns'>;
  now: number;
  config: RoundConfig;
  running: ReadonlySet<string>;
  paused: boolean;
  log?: Pick<TeamMessage, 'from' | 'ts' | 'status'>[];
}

export function isClaimable(t: PlannerTask): boolean {
  return t.ready === true && t.unsafe !== true && !t.claim && t.column !== 'done' && !matchesUnsafeNet(t);
}

function candidates(t: PlannerTask, team: RoundInput['team']): string[] {
  if (t.ownerBotId) return team.some((b) => b.id === t.ownerBotId) ? [t.ownerBotId] : [];
  if (!t.ownerSector) return [];
  return team.filter((b) => b.department === t.ownerSector && !b.primary).map((b) => b.id);
}

const sentSinceClaim = (log: NonNullable<RoundInput['log']>, botId: string, at: number): boolean =>
  log.some((m) => m.from === botId && m.ts >= at && (m.status === 'delivered' || m.status === 'queued'));

export function planRound(i: RoundInput): RoundPlan {
  const plan: RoundPlan = { claims: [], releases: [] };
  if (i.paused) return plan;
  const busy = new Set<string>();
  for (const t of i.tasks) {
    if (!t.claim || t.column === 'done') continue;
    const { botId, at } = t.claim;
    if (i.now - at > CLAIM_STALE_MS && !i.running.has(botId) && !sentSinceClaim(i.log ?? [], botId, at)) {
      plan.releases.push({ taskId: t.id, botId, reason: 'no sign of life for 30 min' });
    }
    busy.add(botId);
  }
  const open = i.tasks
    .filter(isClaimable)
    .sort((a, b) => COLUMN_RANK[a.column] - COLUMN_RANK[b.column] || a.order - b.order);
  for (const t of open) {
    const botId = candidates(t, i.team).find((id) => !busy.has(id)
      && !i.running.has(id)
      && turnsToday(i.state as VillageState, id, i.now) < i.config.dailyCap);
    if (!botId) continue;
    busy.add(botId);
    plan.claims.push({ taskId: t.id, botId });
  }
  return plan;
}

export function claimMessage(task: PlannerTask): string {
  const desc = task.description.trim().slice(0, MESSAGE_DESC_MAX);
  return [
    `Village round: you were handed a board task that a human marked ready for you.`,
    `Task "${task.title}" (${task.id})`,
    desc ? `\n${desc}\n` : '',
    'Work under the NORMAL rules: feature branch, merge by risk. If anything turns out unsafe (production, database, money, secrets, irreversible), stop and ask the human.',
    `Mark progress with "deckctl task edit ${task.id}" / "deckctl task done ${task.id}" and report to the primary bot when done.`,
  ].filter((l) => l !== '').join('\n');
}

export interface RoundDeps {
  now: () => number;
  isPaused: () => boolean;
  getTeam: () => Promise<TeamBot[]>;
  running: (team: TeamBot[]) => Set<string>;
  deliver: (spoolPath: string) => Promise<TeamMessage | null>;
  onBoard: (tasks: PlannerTask[]) => void;
}

export interface RoundResult { claimed: RoundClaim[]; released: RoundRelease[]; failed: RoundClaim[] }

const none = (): RoundResult => ({ claimed: [], released: [], failed: [] });

export async function defaultDeps(): Promise<RoundDeps> {
  const [{ botLiveKey }, { deliverTeamMessage }, { applyBotHandoff }, { processClaimed }, { broadcast }, { emitPlannerMsg }, { scheduleTeamStatePush }] = await Promise.all([
    import('../ws/runs'), import('../ws/team-deliver'), import('../ws/team-handoff'), import('../team-outbox'),
    import('../ws/broadcast'), import('../ws/planner-clients'), import('../ws/team-state-push'),
  ]);
  return {
    now: Date.now,
    isPaused: isTeamPaused,
    getTeam,
    running: (team) => new Set(team.filter((b) => botLiveKey(b.id, b.sessionId)).map((b) => b.id)),
    deliver: (path) => processClaimed(path, {
      getTeam, deliver: deliverTeamMessage, applyHandoff: (m, team) => applyBotHandoff(m, team),
      emit: (item) => { broadcast({ t: 'team-message', item }); scheduleTeamStatePush(); },
    }),
    onBoard: (tasks) => emitPlannerMsg({ t: 'planner-board', tasks }),
  };
}

function senderFor(team: TeamBot[], botId: string): string | undefined {
  const primary = team.find((b) => b.primary && b.id !== botId);
  return (primary ?? team.find((b) => b.id !== botId))?.id;
}

async function spool(from: string, to: string, text: string, now: number): Promise<string> {
  const dir = join(teamOutboxDir(), 'village');
  await mkdir(dir, { recursive: true });
  const id = `m${randomBytes(8).toString('hex')}`;
  const path = join(dir, `${id}.json`);
  await writeFile(path, JSON.stringify({ id, from, to, text, hop: 1, ts: now }), 'utf8');
  return path;
}

async function setClaim(c: RoundClaim, now: number): Promise<PlannerTask | null> {
  let claimed: PlannerTask | null = null;
  await updateTasks((list) => {
    if (list.some((t) => t.claim?.botId === c.botId)) return list;
    const task = list.find((t) => t.id === c.taskId);
    if (!task || !isClaimable(task)) return list;
    const handoff = { at: now, toBotId: c.botId, done: 'nothing yet', pending: task.title.slice(0, PLANNER_LIMITS.handoffText), reason: 'village round', switchPoint: 'claimed by the round' };
    const next: PlannerTask = {
      ...task, claim: { botId: c.botId, at: now }, updatedAt: now,
      ...(task.ownerBotId ? {} : { ownerBotId: c.botId }),
      handoffs: [...(task.handoffs ?? []), handoff].slice(-PLANNER_LIMITS.handoffs),
    };
    claimed = next;
    return list.map((t) => (t.id === task.id ? next : t));
  });
  return claimed;
}

async function dropClaim(c: RoundClaim, restore: PlannerTask | null, now: number): Promise<PlannerTask[]> {
  return updateTasks((list) => list.map((t) => {
    if (t.id !== c.taskId || t.claim?.botId !== c.botId) return t;
    const { claim: _c, ...rest } = t;
    const next: PlannerTask = { ...rest, updatedAt: now };
    if (restore) {
      if (!restore.ownerBotId) delete next.ownerBotId;
      if (restore.handoffs?.length) next.handoffs = restore.handoffs; else delete next.handoffs;
    }
    return next;
  }));
}

export async function runRound(deps?: RoundDeps): Promise<RoundResult> {
  const d = deps ?? await defaultDeps();
  if (d.isPaused()) return none();
  const tasks = await readTasksChained();
  if (!tasks.some((t) => t.claim || isClaimable(t))) return none();
  const team = await d.getTeam();
  const now = d.now();
  const state = await readVillage();
  const plan = planRound({
    tasks, team, state, now, config: { dailyCap: state.dailyCap || VILLAGE_DEFAULT_DAILY_CAP },
    running: d.running(team), paused: false, log: tasks.some((t) => t.claim) ? await readTeamLog() : [],
  });
  const result = none();
  for (const r of plan.releases) {
    const board = await dropClaim(r, null, now);
    await updateVillage((s) => recordEvent(s, { at: now, type: 'release', botId: r.botId, taskId: r.taskId, reason: r.reason }));
    d.onBoard(board);
    result.released.push(r);
  }
  for (const c of plan.claims) {
    const sender = senderFor(team, c.botId);
    const task = sender ? await setClaim(c, now) : null;
    if (!task || !sender) continue;
    const original = tasks.find((t) => t.id === task.id) ?? null;
    d.onBoard(await readTasksChained());
    let delivered = false;
    try {
      const m = await d.deliver(await spool(sender, c.botId, claimMessage(task), now));
      delivered = m?.status === 'delivered' || m?.status === 'queued';
    } catch { delivered = false; }
    if (delivered) {
      await updateVillage((s) => recordEvent(addTurn(s, c.botId, now), { at: now, type: 'claim', botId: c.botId, taskId: c.taskId }));
      result.claimed.push(c);
    } else {
      d.onBoard(await dropClaim(c, original, now));
      await updateVillage((s) => recordEvent(s, { at: now, type: 'release', botId: c.botId, taskId: c.taskId, reason: 'delivery failed' }));
      result.failed.push(c);
    }
  }
  return result;
}
