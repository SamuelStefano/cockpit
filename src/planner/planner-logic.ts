import type { PlannerColumn, PlannerDifficulty, PlannerMove, PlannerTask } from '../../shared/planner';

export const DONE_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export const COLUMN_LABELS: Record<PlannerColumn, string> = { today: 'Hoje', week: 'Semana', backlog: 'Pendentes', done: 'Feito' };
export const DIFFICULTY_LABELS: Record<PlannerDifficulty, string> = { 1: 'Fácil', 2: 'Média', 3: 'Difícil' };

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

export const COLUMN_DOT: Record<PlannerColumn, string> = {
  today: 'bg-orange-500', week: 'bg-sky-400', backlog: 'bg-neutral-500', done: 'bg-emerald-500',
};

export const COLUMN_PAGE = 60;

export function tagsOf(tasks: PlannerTask[]): string[] {
  return [...new Set(tasks.map((t) => t.tag).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b));
}

export function matchesFilter(t: PlannerTask, query: string, tags: string[]): boolean {
  if (tags.length && !(t.tag && tags.includes(t.tag))) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [t.title, t.description, t.ref ?? '', t.tag ?? ''].some((f) => f.toLowerCase().includes(q));
}

export const isLockedRef = (ref: string | undefined): boolean => !!ref && ref.startsWith('DFL-');
