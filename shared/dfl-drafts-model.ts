// Shape, validation and tolerant loading of staged DFL epics. Dependency-free on
// purpose: the `deck-drafts` CLI imports it through native Node type stripping.

export type DraftStatus = 'draft' | 'dispatched' | 'created';

export interface DflDraftTask {
  id: string;
  title: string;
  points: number;
  refs: string[];
  note?: string;
  status: DraftStatus;
}

export interface DflDraftDelivery {
  id: string;
  title: string;
  taskIds: string[];
}

export interface DflDraft {
  id: string;
  title: string;
  // Aggregate of the tasks (see epicStatus); kept on disk so older readers and
  // `deck-drafts list` still see a meaningful value.
  status: DraftStatus;
  createdAt: number;
  dispatchedAt?: number;
  tasks: DflDraftTask[];
  deliveries: DflDraftDelivery[];
}

type TaskInput = { title: string; points: number; refs?: string[]; note?: string };

export type DraftOp =
  | { op: 'add-epic'; title: string; tasks?: TaskInput[]; deliveries?: { title?: string; tasks: TaskInput[] }[] }
  | { op: 'update-epic'; id: string; title: string }
  | { op: 'delete-epic'; id: string }
  // id = epic, delivery or task id (or several): the agent reports back per unit.
  | { op: 'set-status'; id: string | string[]; status: DraftStatus }
  | { op: 'add-task'; epicId: string; title: string; points: number; refs?: string[]; note?: string; deliveryId?: string }
  | { op: 'update-task'; epicId: string; taskId: string; title?: string; points?: number }
  | { op: 'delete-task'; epicId: string; taskId: string }
  | { op: 'add-delivery'; epicId: string; title?: string }
  | { op: 'rename-delivery'; epicId: string; deliveryId: string; title: string }
  | { op: 'delete-delivery'; epicId: string; deliveryId: string }
  | { op: 'move-tasks'; epicId: string; taskIds: string[]; deliveryId: string }
  | { op: 'split-epic'; id: string; taskIds: string[]; title?: string };

export interface DraftCtx { now: number; newId: (prefix: 'ep' | 'tk' | 'dl') => string }

export const MAX_DRAFT_TITLE = 300;
export const MAX_DRAFT_POINTS = 1_000;
const MAX_REFS = 40;
const MAX_REF = 80;
export const STATUSES: ReadonlySet<string> = new Set(['draft', 'dispatched', 'created']);
const RANK: Record<DraftStatus, number> = { draft: 0, dispatched: 1, created: 2 };

export const isStr = (v: unknown): v is string => typeof v === 'string';
export const cleanTitle = (v: unknown): string | null => (isStr(v) && v.trim() ? v.trim().slice(0, MAX_DRAFT_TITLE) : null);
export const cleanPoints = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_DRAFT_POINTS ? Math.round(v * 100) / 100 : null;
export const cleanRefs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(isStr).map((r) => r.trim().slice(0, MAX_REF)).filter(Boolean).slice(0, MAX_REFS) : [];

export const defaultDeliveryTitle = (epicTitle: string): string => `${epicTitle} // Samuel`;

// Stable id for the delivery an old (pre-deliveries) draft is migrated into, so
// every load of the same file yields the same id.
export const legacyDeliveryId = (epicId: string): string => `dl-${epicId.replace(/^ep-/, '')}`;

export function draftPoints(d: { tasks: { points: number }[] }): number {
  return Math.round(d.tasks.reduce((s, t) => s + t.points, 0) * 100) / 100;
}

// An epic is only "dispatched"/"created" once every task is; a half-sent epic
// stays a draft so it keeps showing up as pending work.
export function epicStatus(tasks: DflDraftTask[], fallback: DraftStatus): DraftStatus {
  if (!tasks.length) return fallback;
  return tasks.reduce<DraftStatus>((min, t) => (RANK[t.status] < RANK[min] ? t.status : min), 'created');
}

// Every task in exactly one delivery: unknown ids dropped, duplicates removed,
// orphans appended to the first delivery; no deliveries → one default delivery.
export function normalizeDeliveries(epicId: string, epicTitle: string, tasks: DflDraftTask[], raw: unknown): DflDraftDelivery[] {
  const known = new Set(tasks.map((t) => t.id));
  const placed = new Set<string>();
  const out: DflDraftDelivery[] = [];
  for (const d of Array.isArray(raw) ? raw : []) {
    if (!d || !isStr(d.id) || out.some((x) => x.id === d.id)) continue;
    const ids = (Array.isArray(d.taskIds) ? d.taskIds : []).filter((id: unknown): id is string => isStr(id) && known.has(id) && !placed.has(id));
    ids.forEach((id: string) => placed.add(id));
    out.push({ id: d.id, title: cleanTitle(d.title) ?? defaultDeliveryTitle(epicTitle), taskIds: ids });
  }
  if (!out.length) out.push({ id: legacyDeliveryId(epicId), title: defaultDeliveryTitle(epicTitle), taskIds: [] });
  for (const t of tasks) if (!placed.has(t.id)) out[0].taskIds.push(t.id);
  return out;
}

// Tolerant read of the persisted file: drops malformed rows instead of failing
// the whole screen, and migrates drafts saved before deliveries existed.
export function sanitizeDrafts(raw: unknown): DflDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: DflDraft[] = [];
  for (const d of raw) {
    if (!d || !isStr(d.id) || !isStr(d.title) || !Array.isArray(d.tasks)) continue;
    const epicSt: DraftStatus = STATUSES.has(d.status) ? d.status : 'draft';
    const seen = new Set<string>();
    const tasks: DflDraftTask[] = [];
    for (const t of d.tasks) {
      if (!t || !isStr(t.id) || !isStr(t.title) || cleanPoints(t.points) === null || seen.has(t.id)) continue;
      seen.add(t.id);
      tasks.push({ ...t, refs: cleanRefs(t.refs), status: STATUSES.has(t.status) ? t.status : epicSt });
    }
    out.push({
      id: d.id, title: d.title, tasks,
      deliveries: normalizeDeliveries(d.id, d.title, tasks, d.deliveries),
      status: epicStatus(tasks, epicSt),
      createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
      ...(typeof d.dispatchedAt === 'number' ? { dispatchedAt: d.dispatchedAt } : {}),
    });
  }
  return out;
}

export function deliveryTasks(d: DflDraft, deliveryId: string): DflDraftTask[] {
  const dl = d.deliveries.find((x) => x.id === deliveryId);
  if (!dl) return [];
  const byId = new Map(d.tasks.map((t) => [t.id, t]));
  return dl.taskIds.map((id) => byId.get(id)).filter((t): t is DflDraftTask => !!t);
}
