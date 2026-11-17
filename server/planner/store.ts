import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  PLANNER_COLUMNS, PLANNER_ID_RE, PLANNER_LIMITS, PLANNER_REF_RE,
  type PlannerColumn, type PlannerDifficulty, type PlannerLink, type PlannerMove, type PlannerTask, type TaskClaim, type WantReady,
} from '../../shared/planner';
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
  for (const k of ['sentAt', 'turnStartedAt', 'releasedAt'] as const) if (finite(c[k]) && c[k]! > 0) out[k] = c[k];
  if (typeof c.reason === 'string' && c.reason.trim()) out.reason = c.reason.trim().slice(0, 200);
  return out;
}

export function sanitizeWantReady(v: unknown, now: number): WantReady | undefined {
  const w = v as Partial<WantReady> | null | undefined;
  if (!w || typeof w !== 'object' || typeof w.reason !== 'string') return undefined;
  const reason = w.reason.trim();
  if (!reason || reason.length > PLANNER_LIMITS.wantReason || /[\r\n]/.test(reason)) return undefined;
  const by = typeof w.by === 'string' ? w.by.trim().slice(0, 40) : '';
  if (!by) return undefined;
  return { by, reason, at: finite(w.at) && w.at > 0 ? w.at : now };
}

const sameLinks = (a: PlannerTask['links'], b: PlannerTask['links']) => JSON.stringify(a) === JSON.stringify(b);

export function readyInvalidated(prev: PlannerTask, next: PlannerTask): boolean {
  return prev.title !== next.title || prev.description !== next.description || !sameLinks(prev.links, next.links)
    || (prev.ownerBotId ?? '') !== (next.ownerBotId ?? '') || (prev.ownerSector ?? '') !== (next.ownerSector ?? '')
    || !!prev.unsafe !== !!next.unsafe;
}

export function sanitizeTask(raw: unknown, prev: PlannerTask | undefined, now: number, opts: { fromDisk?: boolean } = {}): PlannerTask | null {
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
    const unsafe = 'unsafe' in r ? r.unsafe === true : prev?.unsafe === true;
    if (unsafe) task.unsafe = true;
    const want = 'wantReady' in r ? sanitizeWantReady(r.wantReady, now) : prev?.wantReady;
    if (want) task.wantReady = want;
  }
  const ownerSector = 'ownerSector' in r ? (isDepartmentId(r.ownerSector) ? r.ownerSector : undefined) : prev?.ownerSector;
  if (ownerSector) task.ownerSector = ownerSector;
  const src = opts.fromDisk ? (r as PlannerTask) : prev;
  if (column !== 'done' && src) {
    if (src.ready === true && src.readyBy === 'human' && finite(src.readyAt)) {
      task.ready = true; task.readyBy = 'human'; task.readyAt = src.readyAt;
    }
    const claim = sanitizeClaim(src.claim);
    if (claim) task.claim = claim;
  }
  if (!opts.fromDisk && prev && task.ready && readyInvalidated(prev, task)) {
    delete task.ready; delete task.readyBy; delete task.readyAt;
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

export function readyForbidden(raw: unknown, prev: PlannerTask | undefined): boolean {
  return (raw as { ready?: unknown } | null | undefined)?.ready === true && !prev?.ready;
}

export function setReady(tasks: PlannerTask[], id: string, ready: boolean, now: number): PlannerTask[] | null {
  const prev = tasks.find((t) => t.id === id);
  if (!prev || prev.column === 'done') return null;
  const next: PlannerTask = { ...prev, updatedAt: now };
  delete next.ready; delete next.readyBy; delete next.readyAt;
  if (ready) {
    next.ready = true; next.readyBy = 'human'; next.readyAt = now;
    delete next.wantReady;
  }
  return tasks.map((t) => (t.id === id ? next : t));
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
    .map((t) => sanitizeTask(t, undefined, (t as PlannerTask)?.updatedAt ?? now, { fromDisk: true }))
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
