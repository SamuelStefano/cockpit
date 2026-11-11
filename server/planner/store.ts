import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  PLANNER_COLUMNS, PLANNER_ID_RE, PLANNER_LIMITS,
  type PlannerColumn, type PlannerDifficulty, type PlannerLink, type PlannerMove, type PlannerTask,
} from '../../shared/planner';
import { withFileLockAsync } from '../ws/file-lock';

function plannerFile(): string {
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

export function sanitizeTask(raw: unknown, prev: PlannerTask | undefined, now: number): PlannerTask | null {
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
    .map((t) => sanitizeTask(t, undefined, (t as PlannerTask)?.updatedAt ?? now))
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
