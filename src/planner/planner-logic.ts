import type { PlannerColumn, PlannerDifficulty, PlannerMove, PlannerTask } from '../../shared/planner';

export const XP_BY_DIFFICULTY: Record<PlannerDifficulty, number> = { 1: 10, 2: 25, 3: 50 };
export const XP_PER_LEVEL = 100;
export const DONE_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export const COLUMN_LABELS: Record<PlannerColumn, string> = { today: 'Hoje', week: 'Semana', backlog: 'Pendentes', done: 'Feito' };
export const DIFFICULTY_LABELS: Record<PlannerDifficulty, string> = { 1: 'Fácil', 2: 'Média', 3: 'Difícil' };

export const taskXp = (t: Pick<PlannerTask, 'difficulty'>): number => XP_BY_DIFFICULTY[t.difficulty];

export const totalXp = (tasks: PlannerTask[]): number =>
  tasks.reduce((sum, t) => (t.column === 'done' ? sum + taskXp(t) : sum), 0);

export const levelOf = (xp: number): number => Math.floor(xp / XP_PER_LEVEL) + 1;

export function levelProgress(xp: number): { level: number; into: number; need: number } {
  return { level: levelOf(xp), into: xp % XP_PER_LEVEL, need: XP_PER_LEVEL };
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const doneDays = (tasks: PlannerTask[]): Set<string> =>
  new Set(tasks.filter((t) => t.column === 'done' && t.doneAt).map((t) => dayKey(t.doneAt!)));

export function doneTodayCount(tasks: PlannerTask[], now: number): number {
  const today = dayKey(now);
  return tasks.filter((t) => t.column === 'done' && t.doneAt && dayKey(t.doneAt) === today).length;
}

// A streak survives until the end of the day after the last completion, so
// opening the Deck in the morning does not show a broken streak.
export function streakDays(tasks: PlannerTask[], now: number): number {
  const days = doneDays(tasks);
  let cursor = now;
  if (!days.has(dayKey(cursor))) cursor -= DAY_MS;
  let n = 0;
  while (days.has(dayKey(cursor))) {
    n += 1;
    const d = new Date(cursor);
    d.setDate(d.getDate() - 1);
    cursor = d.getTime();
  }
  return n;
}

export const todayPendingCount = (tasks: PlannerTask[]): number => tasks.filter((t) => t.column === 'today').length;

export function columnTasks(tasks: PlannerTask[], column: PlannerColumn, opts: { showAllDone?: boolean; now?: number } = {}): PlannerTask[] {
  const inColumn = tasks.filter((t) => t.column === column);
  if (column !== 'done') return inColumn.sort((a, b) => a.order - b.order);
  const cutoff = (opts.now ?? Date.now()) - DONE_WINDOW_DAYS * DAY_MS;
  return inColumn
    .filter((t) => opts.showAllDone || (t.doneAt ?? 0) >= cutoff)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
}

export const hiddenDoneCount = (tasks: PlannerTask[], now: number): number =>
  columnTasks(tasks, 'done', { showAllDone: true }).length - columnTasks(tasks, 'done', { now }).length;

export function orderBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

export function topOrder(tasks: PlannerTask[], column: PlannerColumn): number {
  const first = tasks.filter((t) => t.column === column).reduce<number | undefined>((m, t) => (m === undefined || t.order < m ? t.order : m), undefined);
  return orderBetween(undefined, first);
}

// Index is the slot in the target column AFTER the moved task is lifted out.
export function planMove(tasks: PlannerTask[], id: string, column: PlannerColumn, index: number): PlannerMove | null {
  if (!tasks.some((t) => t.id === id)) return null;
  const rest = tasks.filter((t) => t.column === column && t.id !== id).sort((a, b) => a.order - b.order);
  const at = Math.max(0, Math.min(index, rest.length));
  return { id, column, order: orderBetween(rest[at - 1]?.order, rest[at]?.order) };
}

export function applyMovesLocal(tasks: PlannerTask[], moves: PlannerMove[], now: number): PlannerTask[] {
  const byId = new Map(moves.map((m) => [m.id, m]));
  return tasks.map((t) => {
    const m = byId.get(t.id);
    if (!m) return t;
    const next: PlannerTask = { ...t, column: m.column, order: m.order, updatedAt: now };
    if (m.column === 'done') next.doneAt = t.column === 'done' && t.doneAt ? t.doneAt : now;
    else delete next.doneAt;
    return next;
  });
}

const COLUMN_ORDER: PlannerColumn[] = ['today', 'week', 'backlog', 'done'];
export function adjacentColumn(column: PlannerColumn, dir: -1 | 1): PlannerColumn | null {
  return COLUMN_ORDER[COLUMN_ORDER.indexOf(column) + dir] ?? null;
}

export function newTaskId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function linkChipLabel(link: { url: string; label?: string }): string {
  if (link.label) return link.label;
  try { return new URL(link.url).hostname.replace(/^www\./, ''); } catch { return link.url; }
}

export function levelUpOnDone(tasks: PlannerTask[], task: PlannerTask): number | null {
  const xp = totalXp(tasks);
  const after = levelOf(xp + taskXp(task));
  return after > levelOf(xp) ? after : null;
}

export const COLUMN_ACCENT: Record<PlannerColumn, { dot: string; border: string }> = {
  today: { dot: 'bg-orange-500', border: 'border-t-orange-500/60' },
  week: { dot: 'bg-sky-400', border: 'border-t-sky-400/60' },
  backlog: { dot: 'bg-violet-400', border: 'border-t-violet-400/60' },
  done: { dot: 'bg-emerald-400', border: 'border-t-emerald-400/60' },
};
