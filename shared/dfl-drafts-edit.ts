// Delivery-level edits of a staged epic (add/rename/delete a delivery, move tasks
// between deliveries, split an epic in two) plus the helpers every op shares.
// Dependency-free like the model: the CLI imports it with native type stripping.
import {
  cleanPoints, cleanRefs, cleanTitle, defaultDeliveryTitle, epicStatus, isStr, MAX_DRAFT_POINTS,
  type DflDraft, type DflDraftDelivery, type DflDraftTask, type DraftCtx, type DraftOp, type DraftStatus,
} from './dfl-drafts-model.ts';

export const POINTS_ERR = `pontos inválidos (0..${MAX_DRAFT_POINTS})`;

// Ids from a raw WS frame or the CLI: only strings count.
export const idList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);

export function newTask(raw: { title: unknown; points: unknown; refs?: unknown; note?: unknown }, ctx: DraftCtx): DflDraftTask {
  const t = cleanTitle(raw.title);
  const p = cleanPoints(raw.points);
  if (t === null) throw new Error('título da task obrigatório');
  if (p === null) throw new Error(POINTS_ERR);
  const task: DflDraftTask = { id: ctx.newId('tk'), title: t, points: p, refs: cleanRefs(raw.refs), status: 'draft' };
  if (isStr(raw.note) && raw.note.trim()) task.note = raw.note.trim().slice(0, 1000);
  return task;
}

// Re-derives the aggregate status (and dispatchedAt) after any change to an epic.
export function settle(d: DflDraft, ctx: DraftCtx, fallback: DraftStatus = d.status): DflDraft {
  const status = epicStatus(d.tasks, fallback);
  const sent = d.tasks.some((t) => t.status !== 'draft') || (!d.tasks.length && status !== 'draft');
  const { dispatchedAt, ...rest } = d;
  return { ...rest, status, ...(sent ? { dispatchedAt: dispatchedAt ?? ctx.now } : {}) };
}

export function withEpic(drafts: DflDraft[], id: string, ctx: DraftCtx, fn: (d: DflDraft) => DflDraft): DflDraft[] {
  if (!drafts.some((d) => d.id === id)) throw new Error(`épico ${id} não existe`);
  return drafts.map((d) => (d.id === id ? settle(fn(d), ctx) : d));
}

export function findDelivery(d: DflDraft, id: string): DflDraftDelivery {
  const dl = d.deliveries.find((x) => x.id === id);
  if (!dl) throw new Error(`delivery ${id} não existe`);
  return dl;
}

function renameDelivery(d: DflDraft, id: string, title: string): DflDraft {
  findDelivery(d, id);
  return { ...d, deliveries: d.deliveries.map((x) => (x.id === id ? { ...x, title } : x)) };
}

function deleteDelivery(d: DflDraft, id: string): DflDraft {
  const gone = findDelivery(d, id);
  if (d.deliveries.length === 1) throw new Error('o épico precisa de ao menos uma delivery');
  const rest = d.deliveries.filter((x) => x.id !== gone.id);
  return { ...d, deliveries: rest.map((x, i) => (i === 0 ? { ...x, taskIds: [...x.taskIds, ...gone.taskIds] } : x)) };
}

function moveTasks(d: DflDraft, taskIds: string[], to: string): DflDraft {
  findDelivery(d, to);
  const moving = new Set(idList(taskIds));
  const ordered = d.tasks.filter((t) => moving.has(t.id)).map((t) => t.id);
  return {
    ...d,
    deliveries: d.deliveries.map((x) => ({
      ...x, taskIds: [...x.taskIds.filter((id) => !moving.has(id)), ...(x.id === to ? ordered : [])],
    })),
  };
}

// Rule 1 (R$ 5k per epic) is met by splitting, never by trimming points: the
// chosen tasks move, with their points, to a new epic right after the source.
function splitEpic(drafts: DflDraft[], op: Extract<DraftOp, { op: 'split-epic' }>, ctx: DraftCtx): DflDraft[] {
  const src = drafts.find((d) => d.id === op.id);
  if (!src) throw new Error(`épico ${op.id} não existe`);
  const moving = new Set(idList(op.taskIds).filter((id) => src.tasks.some((t) => t.id === id)));
  if (!moving.size) throw new Error('escolha ao menos uma task pra mover');
  if (moving.size === src.tasks.length) throw new Error('o épico original ficaria vazio');
  const title = cleanTitle(op.title) ?? `${src.title} (parte 2)`;
  const tasks = src.tasks.filter((t) => moving.has(t.id));
  const created = settle({
    id: ctx.newId('ep'), title, status: 'draft', createdAt: ctx.now, tasks,
    deliveries: [{ id: ctx.newId('dl'), title: defaultDeliveryTitle(title), taskIds: tasks.map((t) => t.id) }],
  }, ctx);
  // A delivery emptied by the split goes away, as long as one is left.
  const left = src.deliveries.map((x) => ({ ...x, taskIds: x.taskIds.filter((id) => !moving.has(id)) }));
  const kept = settle({
    ...src,
    tasks: src.tasks.filter((t) => !moving.has(t.id)),
    deliveries: left.some((x) => x.taskIds.length) ? left.filter((x) => x.taskIds.length) : left.slice(0, 1),
  }, ctx);
  return drafts.flatMap((d) => (d.id === src.id ? [kept, created] : [d]));
}

export function applyDeliveryOp(drafts: DflDraft[], op: DraftOp, ctx: DraftCtx): DflDraft[] {
  switch (op.op) {
    case 'add-delivery':
      return withEpic(drafts, op.epicId, ctx, (d) => {
        const id = ctx.newId('dl');
        const added = { ...d, deliveries: [...d.deliveries, { id, title: cleanTitle(op.title) ?? `${defaultDeliveryTitle(d.title)} ${d.deliveries.length + 1}`, taskIds: [] }] };
        return idList(op.taskIds).length ? moveTasks(added, op.taskIds ?? [], id) : added;
      });
    case 'rename-delivery': {
      const t = cleanTitle(op.title);
      if (t === null) throw new Error('título da delivery obrigatório');
      return withEpic(drafts, op.epicId, ctx, (d) => renameDelivery(d, op.deliveryId, t));
    }
    case 'delete-delivery':
      return withEpic(drafts, op.epicId, ctx, (d) => deleteDelivery(d, op.deliveryId));
    case 'move-tasks':
      return withEpic(drafts, op.epicId, ctx, (d) => moveTasks(d, op.taskIds, op.deliveryId));
    case 'split-epic':
      return splitEpic(drafts, op, ctx);
    default:
      throw new Error('operação desconhecida');
  }
}
