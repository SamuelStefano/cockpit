// Staged DFL epics: the orchestrator leaves epic → tasks here, Samuel reviews on
// /pontos and one click dispatches the agent that creates them in DFL. The Deck
// never writes to DFL itself. Pure and dependency-free on purpose: the server,
// the browser and the standalone `deck-drafts` CLI (native Node type stripping)
// all import this file, so it cannot import anything else.

export type DraftStatus = 'draft' | 'dispatched' | 'created';

export interface DflDraftTask {
  id: string;
  title: string;
  points: number;
  refs: string[];
  note?: string;
}

export interface DflDraft {
  id: string;
  title: string;
  status: DraftStatus;
  createdAt: number;
  dispatchedAt?: number;
  tasks: DflDraftTask[];
}

export type DraftOp =
  | { op: 'add-epic'; title: string; tasks?: { title: string; points: number; refs?: string[]; note?: string }[] }
  | { op: 'update-epic'; id: string; title: string }
  | { op: 'delete-epic'; id: string }
  | { op: 'set-status'; id: string; status: DraftStatus }
  | { op: 'add-task'; epicId: string; title: string; points: number; refs?: string[]; note?: string }
  | { op: 'update-task'; epicId: string; taskId: string; title?: string; points?: number }
  | { op: 'delete-task'; epicId: string; taskId: string };

export interface DraftCtx { now: number; newId: (prefix: 'ep' | 'tk') => string }

export const MAX_DRAFT_TITLE = 300;
export const MAX_DRAFT_POINTS = 1_000;
const MAX_REFS = 40;
const MAX_REF = 80;
const STATUSES: ReadonlySet<string> = new Set(['draft', 'dispatched', 'created']);

const str = (v: unknown): v is string => typeof v === 'string';
const title = (v: unknown): string | null => (str(v) && v.trim() ? v.trim().slice(0, MAX_DRAFT_TITLE) : null);
const points = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_DRAFT_POINTS ? Math.round(v * 100) / 100 : null;
const refs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(str).map((r) => r.trim().slice(0, MAX_REF)).filter(Boolean).slice(0, MAX_REFS) : [];

export function draftPoints(d: DflDraft): number {
  return Math.round(d.tasks.reduce((s, t) => s + t.points, 0) * 100) / 100;
}

function newTask(raw: { title: unknown; points: unknown; refs?: unknown; note?: unknown }, ctx: DraftCtx): DflDraftTask {
  const t = title(raw.title);
  const p = points(raw.points);
  if (t === null) throw new Error('título da task obrigatório');
  if (p === null) throw new Error(`pontos inválidos (0..${MAX_DRAFT_POINTS})`);
  const task: DflDraftTask = { id: ctx.newId('tk'), title: t, points: p, refs: refs(raw.refs) };
  if (str(raw.note) && raw.note.trim()) task.note = raw.note.trim().slice(0, 1000);
  return task;
}

function withEpic(drafts: DflDraft[], id: string, fn: (d: DflDraft) => DflDraft): DflDraft[] {
  if (!drafts.some((d) => d.id === id)) throw new Error(`épico ${id} não existe`);
  return drafts.map((d) => (d.id === id ? fn(d) : d));
}

// PURE: returns the next list or throws with a human message. Every mutation
// from the UI and the CLI goes through here, so the validation lives in one place.
export function applyDraftOp(drafts: DflDraft[], op: DraftOp, ctx: DraftCtx): DflDraft[] {
  switch (op.op) {
    case 'add-epic': {
      const t = title(op.title);
      if (t === null) throw new Error('título do épico obrigatório');
      const tasks = (op.tasks ?? []).map((x) => newTask(x, ctx));
      return [...drafts, { id: ctx.newId('ep'), title: t, status: 'draft', createdAt: ctx.now, tasks }];
    }
    case 'update-epic': {
      const t = title(op.title);
      if (t === null) throw new Error('título do épico obrigatório');
      return withEpic(drafts, op.id, (d) => ({ ...d, title: t }));
    }
    case 'delete-epic':
      return drafts.filter((d) => d.id !== op.id);
    case 'set-status': {
      if (!STATUSES.has(op.status)) throw new Error('status inválido');
      return withEpic(drafts, op.id, (d) => ({
        ...d, status: op.status, dispatchedAt: op.status === 'draft' ? undefined : d.dispatchedAt ?? ctx.now,
      }));
    }
    case 'add-task':
      return withEpic(drafts, op.epicId, (d) => ({ ...d, tasks: [...d.tasks, newTask(op, ctx)] }));
    case 'update-task':
      return withEpic(drafts, op.epicId, (d) => {
        if (!d.tasks.some((t) => t.id === op.taskId)) throw new Error(`task ${op.taskId} não existe`);
        const t = op.title === undefined ? undefined : title(op.title);
        const p = op.points === undefined ? undefined : points(op.points);
        if (t === null) throw new Error('título da task obrigatório');
        if (p === null) throw new Error(`pontos inválidos (0..${MAX_DRAFT_POINTS})`);
        return { ...d, tasks: d.tasks.map((x) => (x.id === op.taskId ? { ...x, ...(t ? { title: t } : {}), ...(p !== undefined ? { points: p } : {}) } : x)) };
      });
    case 'delete-task':
      return withEpic(drafts, op.epicId, (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== op.taskId) }));
    default:
      throw new Error('operação desconhecida');
  }
}

const OPS: ReadonlySet<string> = new Set(['add-epic', 'update-epic', 'delete-epic', 'set-status', 'add-task', 'update-task', 'delete-task']);

// Edge guard for a raw WS frame: shape only; value rules stay in applyDraftOp.
export function isDraftOp(v: unknown): v is DraftOp {
  return !!v && typeof v === 'object' && OPS.has((v as { op?: unknown }).op as string);
}

// Tolerant read of the persisted file: drops malformed rows instead of failing
// the whole screen.
export function sanitizeDrafts(raw: unknown): DflDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: DflDraft[] = [];
  for (const d of raw) {
    if (!d || !str(d.id) || !str(d.title) || !Array.isArray(d.tasks)) continue;
    const tasks = d.tasks
      .filter((t: unknown): t is DflDraftTask => !!t && str((t as DflDraftTask).id) && str((t as DflDraftTask).title) && points((t as DflDraftTask).points) !== null)
      .map((t: DflDraftTask) => ({ ...t, refs: refs(t.refs) }));
    out.push({
      id: d.id, title: d.title, tasks,
      status: STATUSES.has(d.status) ? d.status : 'draft',
      createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
      ...(typeof d.dispatchedAt === 'number' ? { dispatchedAt: d.dispatchedAt } : {}),
    });
  }
  return out;
}
