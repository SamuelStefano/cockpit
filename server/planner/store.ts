import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  PLANNER_COLUMNS, PLANNER_ID_RE, PLANNER_LIMITS, PLANNER_REF_RE, READY_BY_RE,
  type PlannerColumn, type PlannerDifficulty, type PlannerLink, type PlannerMove, type PlannerTask, type TaskClaim, type WantReady,
} from '../../shared/planner';
import { isUnsafeTask } from '../../shared/village-risk';
import { isDepartmentId } from '../../shared/departments';
import { sanitizeHandoffs } from '../../shared/task-handoff';
import { withFileLockAsync } from '../ws/file-lock';

export function plannerFile(): string {
  return process.env.COCKPIT_PLANNER ?? join(homedir(), '.cockpit', 'planner.json');
}

const isColumn = (v: unknown): v is PlannerColumn => typeof v === 'string' && (PLANNER_COLUMNS as readonly string[]).includes(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitizeLinks(raw: unknown): PlannerLink[] {
  if (!Array.isArray(raw)) return [];
  const out: PlannerLink[] = [];
  for (const l of raw) {
    if (out.length >= PLANNER_LIMITS.links) break;
    const url = typeof l?.url === 'string' ? l.url.trim().slice(0, PLANNER_LIMITS.linkUrl) : '';
    let parsed: URL;
    try { parsed = new URL(url); } catch { continue; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    const label = typeof l.label === 'string' ? l.label.trim().slice(0, PLANNER_LIMITS.linkLabel) : '';
    out.push(label ? { url: parsed.href, label } : { url: parsed.href });
  }
  return out;
}

export function clampDifficulty(v: unknown): PlannerDifficulty {
  const n = Math.round(Number(v));
  return n <= 1 || !Number.isFinite(n) ? 1 : n >= 3 ? 3 : 2;
}

function sanitizeRef(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const ref = v.trim();
  return PLANNER_REF_RE.test(ref) ? ref : undefined;
}

function sanitizeTag(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const tag = v.trim().replace(/\s+/g, ' ').slice(0, PLANNER_LIMITS.tag).trim();
  return tag || undefined;
}

function sanitizeOwner(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const id = v.trim();
  return PLANNER_ID_RE.test(id) ? id : undefined;
}

function sanitizeClaim(v: unknown): TaskClaim | undefined {
  const c = v as Partial<TaskClaim> | null | undefined;
  if (!c || typeof c !== 'object' || typeof c.botId !== 'string' || !PLANNER_ID_RE.test(c.botId) || !finite(c.at) || c.at <= 0) return undefined;
  const out: TaskClaim = { botId: c.botId, at: c.at };
  if (finite(c.sentAt) && c.sentAt > 0) out.sentAt = c.sentAt;
  if (finite(c.turnStartedAt) && c.turnStartedAt > 0) out.turnStartedAt = c.turnStartedAt;
  return out;
}

function sanitizeWantReady(v: unknown, prev: WantReady | undefined, now: number, trusted: boolean): WantReady | undefined {
  const w = v as Partial<WantReady> | null | undefined;
  if (!w || typeof w !== 'object' || typeof w.reason !== 'string') return undefined;
  const reason = w.reason.replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, PLANNER_LIMITS.wantReadyReason).trim();
  if (!reason) return undefined;
  const by = sanitizeOwner(w.by) ?? 'bot';
  const at = trusted && finite(w.at) && w.at > 0 ? w.at : prev && prev.by === by && prev.reason === reason ? prev.at : now;
  return { by, reason, at };
}

export interface SanitizeOpts { trusted?: boolean; human?: string }

export function readyAttempt(raw: unknown, prev: PlannerTask | undefined): boolean {
  const r = raw as { ready?: unknown } | null | undefined;
  return !!r && typeof r === 'object' && r.ready === true && prev?.ready !== true;
}

export type MarkReadyResult = { ok: true; task: PlannerTask } | { ok: false; reason: string };

export function markReady(task: PlannerTask, human: string, now: number): MarkReadyResult {
  const readyBy = `human:${human}`;
  if (!READY_BY_RE.test(readyBy)) return { ok: false, reason: 'no verified human identity' };
  if (task.column === 'done') return { ok: false, reason: 'task is done' };
  if (isUnsafeTask(task)) return { ok: false, reason: 'task is unsafe' };
  const { wantReady: _w, ...rest } = task;
  return { ok: true, task: { ...rest, ready: true, readyBy, readyAt: now, updatedAt: now } };
}

export function sanitizeTask(raw: unknown, prev: PlannerTask | undefined, now: number, opts: SanitizeOpts = {}): PlannerTask | null {
  const r = raw as Partial<PlannerTask> | null | undefined;
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !PLANNER_ID_RE.test(r.id)) return null;
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, PLANNER_LIMITS.title) : '';
  if (!title) return null;
  const column = isColumn(r.column) ? r.column : 'backlog';
  const task: PlannerTask = {
    id: r.id,
    title,
    description: typeof r.description === 'string' ? r.description.slice(0, PLANNER_LIMITS.description) : '',
    links: sanitizeLinks(r.links),
    difficulty: clampDifficulty(r.difficulty),
    column,
    order: finite(r.order) ? r.order : prev?.order ?? now,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  if (r.source === 'agent' || prev?.source === 'agent') task.source = 'agent';
  const ref = 'ref' in r ? sanitizeRef(r.ref) : prev?.ref;
  if (ref) task.ref = ref;
  const tag = 'tag' in r ? sanitizeTag(r.tag) : prev?.tag;
  if (tag) task.tag = tag;
  const ownerBotId = 'ownerBotId' in r ? sanitizeOwner(r.ownerBotId) : prev?.ownerBotId;
  if (ownerBotId) task.ownerBotId = ownerBotId;
  if (column !== 'done') {
    const open = !!opts.trusted || !!opts.human;
    const wantUnsafe = 'unsafe' in r ? r.unsafe === true : prev?.unsafe === true;
    if (wantUnsafe || (prev?.unsafe === true && !open)) task.unsafe = true;
    const ownerSectorNext = 'ownerSector' in r ? (isDepartmentId(r.ownerSector) ? r.ownerSector : undefined) : prev?.ownerSector;
    const edited = !!prev && (task.title !== prev.title || task.description !== prev.description
      || JSON.stringify(task.links) !== JSON.stringify(prev.links) || !!task.unsafe !== !!prev.unsafe
      || task.ownerBotId !== prev.ownerBotId || ownerSectorNext !== prev.ownerSector);
    const src = opts.trusted ? r : prev && !edited && (r as { ready?: unknown }).ready !== false ? prev : undefined;
    if (src?.ready === true && typeof src.readyBy === 'string' && READY_BY_RE.test(src.readyBy) && finite(src.readyAt) && src.readyAt > 0) {
      task.ready = true;
      task.readyBy = src.readyBy;
      task.readyAt = src.readyAt;
    }
    const wantReady = 'wantReady' in r ? sanitizeWantReady(r.wantReady, prev?.wantReady, now, !!opts.trusted) : prev?.wantReady;
    if (wantReady) task.wantReady = wantReady;
  }
  const ownerSector = 'ownerSector' in r ? (isDepartmentId(r.ownerSector) ? r.ownerSector : undefined) : prev?.ownerSector;
  if (ownerSector) task.ownerSector = ownerSector;
  if (column !== 'done') {
    const claim = opts.trusted ? sanitizeClaim(r.claim) : prev?.claim;
    const ownerMoved = !!prev && (task.ownerBotId !== prev.ownerBotId || task.ownerSector !== prev.ownerSector);
    if (claim && !(ownerMoved && !opts.trusted)) task.claim = claim;
  }
  const handoffs = prev ? prev.handoffs ?? [] : sanitizeHandoffs(r.handoffs);
  if (handoffs.length) task.handoffs = handoffs;
  if (column === 'done') task.doneAt = prev?.column === 'done' && prev.doneAt ? prev.doneAt : finite(r.doneAt) && r.doneAt > 0 ? r.doneAt : now;
  return task;
}

export function applyMoves(tasks: PlannerTask[], moves: unknown, now: number): PlannerTask[] {
  if (!Array.isArray(moves)) return tasks;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const m of moves as Partial<PlannerMove>[]) {
    const prev = typeof m?.id === 'string' ? byId.get(m.id) : undefined;
    if (!prev || !isColumn(m.column) || !finite(m.order)) continue;
    const next: PlannerTask = { ...prev, column: m.column, order: m.order, updatedAt: now };
    if (m.column === 'done') next.doneAt = prev.column === 'done' && prev.doneAt ? prev.doneAt : now;
    else delete next.doneAt;
    if (m.column === 'done') { delete next.claim; delete next.ready; delete next.readyBy; delete next.readyAt; delete next.wantReady; }
    byId.set(prev.id, next);
  }
  return tasks.map((t) => byId.get(t.id) ?? t);
}

export function upsertTask(tasks: PlannerTask[], task: PlannerTask): PlannerTask[] | null {
  const i = tasks.findIndex((t) => t.id === task.id);
  if (i < 0) return tasks.length >= PLANNER_LIMITS.tasks ? null : [...tasks, task];
  return tasks.map((t, j) => (j === i ? task : t));
}

export async function readTasks(): Promise<PlannerTask[]> {
  let raw: string;
  try {
    raw = await readFile(plannerFile(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw err;
  }
  const parsed = JSON.parse(raw) as { tasks?: unknown };
  const list = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const now = Date.now();
  return list
    .map((t) => sanitizeTask(t, undefined, (t as PlannerTask)?.updatedAt ?? now, { trusted: true }))
    .filter((t): t is PlannerTask => !!t)
    .slice(0, PLANNER_LIMITS.tasks);
}

let chain: Promise<unknown> = Promise.resolve();
export function updateTasks(fn: (tasks: PlannerTask[]) => PlannerTask[]): Promise<PlannerTask[]> {
  const next = chain.then(() => withFileLockAsync(plannerFile(), async () => {
    const updated = fn(await readTasks());
    const f = plannerFile();
    await mkdir(dirname(f), { recursive: true });
    const tmp = `${f}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmp, JSON.stringify({ tasks: updated }), 'utf8');
    await rename(tmp, f);
    return updated;
  }));
  chain = next.catch(() => undefined);
  return next;
}

export function readTasksChained(): Promise<PlannerTask[]> {
  const next = chain.then(() => readTasks());
  chain = next.catch(() => undefined);
  return next;
}
