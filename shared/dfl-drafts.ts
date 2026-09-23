// Staged DFL epics: the orchestrator leaves epic → deliveries → tasks here, Samuel
// reviews on /pontos and a click dispatches the agent that creates them in DFL.
// The Deck never writes to DFL itself. Pure: the server, the browser and the
// standalone `deck-drafts` CLI (native Node type stripping) all import this file,
// so it only imports its equally dependency-free siblings, with the extension.
import {
  STATUSES, cleanPoints, cleanTitle, defaultDeliveryTitle,
  type DflDraft, type DflDraftTask, type DraftCtx, type DraftOp, type DraftStatus,
} from './dfl-drafts-model.ts';
import { POINTS_ERR, applyDeliveryOp, findDelivery, newTask, settle, withEpic } from './dfl-drafts-edit.ts';

export * from './dfl-drafts-model.ts';

function buildEpic(op: Extract<DraftOp, { op: 'add-epic' }>, ctx: DraftCtx): DflDraft {
  const title = cleanTitle(op.title);
  if (title === null) throw new Error('título do épico obrigatório');
  const groups = op.deliveries?.length ? op.deliveries : [{ title: undefined, tasks: op.tasks ?? [] }];
  const tasks: DflDraftTask[] = [];
  const deliveries = groups.map((g) => {
    const ts = g.tasks.map((x) => newTask(x, ctx));
    tasks.push(...ts);
    return { id: ctx.newId('dl'), title: cleanTitle(g.title) ?? defaultDeliveryTitle(title), taskIds: ts.map((t) => t.id) };
  });
  return { id: ctx.newId('ep'), title, status: 'draft', createdAt: ctx.now, tasks, deliveries };
}

// Ids may name an epic (all its tasks), a delivery (its tasks) or single tasks.
function setStatus(drafts: DflDraft[], ids: string[], status: DraftStatus, ctx: DraftCtx): DflDraft[] {
  if (!STATUSES.has(status)) throw new Error('status inválido');
  const want = new Set(ids);
  const found = new Set<string>();
  const next = drafts.map((d) => {
    const epicHit = want.has(d.id);
    const touched = new Set<string>();
    if (epicHit) { found.add(d.id); d.tasks.forEach((t) => touched.add(t.id)); }
    for (const dl of d.deliveries) if (want.has(dl.id)) { found.add(dl.id); dl.taskIds.forEach((id) => touched.add(id)); }
    for (const t of d.tasks) if (want.has(t.id)) { found.add(t.id); touched.add(t.id); }
    if (!epicHit && !touched.size) return d;
    return settle({ ...d, tasks: d.tasks.map((t) => (touched.has(t.id) ? { ...t, status } : t)) }, ctx, epicHit ? status : d.status);
  });
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new Error(`id não encontrado: ${missing.join(', ')}`);
  return next;
}

function updateTask(d: DflDraft, op: Extract<DraftOp, { op: 'update-task' }>): DflDraft {
  if (!d.tasks.some((t) => t.id === op.taskId)) throw new Error(`task ${op.taskId} não existe`);
  const t = op.title === undefined ? undefined : cleanTitle(op.title);
  const p = op.points === undefined ? undefined : cleanPoints(op.points);
  if (t === null) throw new Error('título da task obrigatório');
  if (p === null) throw new Error(POINTS_ERR);
  return { ...d, tasks: d.tasks.map((x) => (x.id === op.taskId ? { ...x, ...(t ? { title: t } : {}), ...(p !== undefined ? { points: p } : {}) } : x)) };
}

// PURE: returns the next list or throws with a human message. Every mutation
// from the UI and the CLI goes through here, so the validation lives in one place.
export function applyDraftOp(drafts: DflDraft[], op: DraftOp, ctx: DraftCtx): DflDraft[] {
  switch (op.op) {
    case 'add-epic':
      return [...drafts, buildEpic(op, ctx)];
    case 'update-epic': {
      const t = cleanTitle(op.title);
      if (t === null) throw new Error('título do épico obrigatório');
      // A delivery still carrying the default name follows the epic's new title.
      return withEpic(drafts, op.id, ctx, (d) => ({
        ...d, title: t,
        deliveries: d.deliveries.map((x) => (x.title === defaultDeliveryTitle(d.title) ? { ...x, title: defaultDeliveryTitle(t) } : x)),
      }));
    }
    case 'delete-epic':
      return drafts.filter((d) => d.id !== op.id);
    case 'set-status':
      return setStatus(drafts, Array.isArray(op.id) ? op.id : [op.id], op.status, ctx);
    case 'add-task':
      return withEpic(drafts, op.epicId, ctx, (d) => {
        const task = newTask(op, ctx);
        const target = op.deliveryId ? findDelivery(d, op.deliveryId).id : d.deliveries[0].id;
        return { ...d, tasks: [...d.tasks, task], deliveries: d.deliveries.map((x) => (x.id === target ? { ...x, taskIds: [...x.taskIds, task.id] } : x)) };
      });
    case 'update-task':
      return withEpic(drafts, op.epicId, ctx, (d) => updateTask(d, op));
    case 'delete-task':
      return withEpic(drafts, op.epicId, ctx, (d) => ({
        ...d,
        tasks: d.tasks.filter((t) => t.id !== op.taskId),
        deliveries: d.deliveries.map((x) => ({ ...x, taskIds: x.taskIds.filter((id) => id !== op.taskId) })),
      }));
    default:
      return applyDeliveryOp(drafts, op, ctx);
  }
}

const OPS: ReadonlySet<string> = new Set([
  'add-epic', 'update-epic', 'delete-epic', 'set-status', 'add-task', 'update-task', 'delete-task',
  'add-delivery', 'rename-delivery', 'delete-delivery', 'move-tasks', 'split-epic',
]);

// Edge guard for a raw WS frame: shape only; value rules stay in applyDraftOp.
export function isDraftOp(v: unknown): v is DraftOp {
  return !!v && typeof v === 'object' && OPS.has((v as { op?: unknown }).op as string);
}
