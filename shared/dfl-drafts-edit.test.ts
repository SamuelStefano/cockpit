import { describe, it, expect } from 'vitest';
import { applyDraftOp, type DflDraft, type DraftCtx } from './dfl-drafts';

function ctx(now = 1000): DraftCtx {
  let n = 0;
  return { now, newId: (p) => `${p}-${++n}` };
}

// ep-5: dl-4 = [tk-1, tk-2, tk-3]
const seed = (): DflDraft[] => applyDraftOp([], {
  op: 'add-epic', title: 'Studio', tasks: [{ title: 'A', points: 30 }, { title: 'B', points: 20 }, { title: 'C', points: 30 }],
}, ctx());

describe('delivery ops', () => {
  it('adds, renames and moves tasks between deliveries, keeping epic order', () => {
    let d = applyDraftOp(seed(), { op: 'add-delivery', epicId: 'ep-5', title: 'Backend' }, { now: 1, newId: () => 'dl-new' });
    d = applyDraftOp(d, { op: 'move-tasks', epicId: 'ep-5', taskIds: ['tk-3', 'tk-1'], deliveryId: 'dl-new' }, ctx());
    expect(d[0].deliveries).toEqual([
      { id: 'dl-4', title: 'Studio // Samuel', taskIds: ['tk-2'] },
      { id: 'dl-new', title: 'Backend', taskIds: ['tk-1', 'tk-3'] },
    ]);
    d = applyDraftOp(d, { op: 'rename-delivery', epicId: 'ep-5', deliveryId: 'dl-4', title: 'Front' }, ctx());
    expect(d[0].deliveries[0].title).toBe('Front');
  });

  it('deleting a delivery hands its tasks to the first remaining one; the last one cannot go', () => {
    let d = applyDraftOp(seed(), { op: 'add-delivery', epicId: 'ep-5' }, { now: 1, newId: () => 'dl-x' });
    expect(d[0].deliveries[1].title).toBe('Studio // Samuel 2');
    d = applyDraftOp(d, { op: 'move-tasks', epicId: 'ep-5', taskIds: ['tk-2'], deliveryId: 'dl-x' }, ctx());
    d = applyDraftOp(d, { op: 'delete-delivery', epicId: 'ep-5', deliveryId: 'dl-4' }, ctx());
    expect(d[0].deliveries).toEqual([{ id: 'dl-x', title: 'Studio // Samuel 2', taskIds: ['tk-2', 'tk-1', 'tk-3'] }]);
    expect(() => applyDraftOp(d, { op: 'delete-delivery', epicId: 'ep-5', deliveryId: 'dl-x' }, ctx())).toThrow(/ao menos uma/);
  });

  it('a new delivery can take the selected tasks in the same step', () => {
    const d = applyDraftOp(seed(), { op: 'add-delivery', epicId: 'ep-5', title: 'Infra', taskIds: ['tk-2'] }, { now: 1, newId: () => 'dl-i' });
    expect(d[0].deliveries.map((x) => [x.id, x.taskIds])).toEqual([['dl-4', ['tk-1', 'tk-3']], ['dl-i', ['tk-2']]]);
  });

  it('adds a task straight into a chosen delivery', () => {
    let d = applyDraftOp(seed(), { op: 'add-delivery', epicId: 'ep-5' }, { now: 1, newId: () => 'dl-x' });
    d = applyDraftOp(d, { op: 'add-task', epicId: 'ep-5', deliveryId: 'dl-x', title: 'D', points: 1 }, { now: 1, newId: () => 'tk-d' });
    expect(d[0].deliveries[1].taskIds).toEqual(['tk-d']);
  });

  it('renaming the epic renames deliveries still carrying the default name', () => {
    const d = applyDraftOp(seed(), { op: 'update-epic', id: 'ep-5', title: 'Lesson Studio' }, ctx());
    expect(d[0].deliveries[0].title).toBe('Lesson Studio // Samuel');
  });
});

describe('split-epic', () => {
  it('moves the chosen tasks, points intact, to a new epic right after the source', () => {
    const d = applyDraftOp(seed(), { op: 'split-epic', id: 'ep-5', taskIds: ['tk-3'] }, { now: 9, newId: (p) => `${p}-z` });
    expect(d.map((x) => x.title)).toEqual(['Studio', 'Studio (parte 2)']);
    expect(d[0].tasks.map((t) => t.id)).toEqual(['tk-1', 'tk-2']);
    expect(d[0].deliveries[0].taskIds).toEqual(['tk-1', 'tk-2']);
    expect(d[1]).toMatchObject({ id: 'ep-z', createdAt: 9, deliveries: [{ id: 'dl-z', title: 'Studio (parte 2) // Samuel', taskIds: ['tk-3'] }] });
    expect(d[1].tasks[0].points).toBe(30);
  });

  it('refuses an empty selection or one that empties the source', () => {
    expect(() => applyDraftOp(seed(), { op: 'split-epic', id: 'ep-5', taskIds: [] }, ctx())).toThrow(/ao menos uma/);
    expect(() => applyDraftOp(seed(), { op: 'split-epic', id: 'ep-5', taskIds: ['tk-1', 'tk-2', 'tk-3'] }, ctx())).toThrow(/vazio/);
  });
});

describe('set-status at any level', () => {
  it('a delivery or a task can be sent alone; the epic stays pending until every task left', () => {
    let d = applyDraftOp(seed(), { op: 'set-status', id: ['tk-1', 'tk-2'], status: 'dispatched' }, ctx(50));
    expect(d[0]).toMatchObject({ status: 'draft', dispatchedAt: 50 });
    expect(d[0].tasks.map((t) => t.status)).toEqual(['dispatched', 'dispatched', 'draft']);
    d = applyDraftOp(d, { op: 'set-status', id: 'dl-4', status: 'created' }, ctx(60));
    expect(d[0]).toMatchObject({ status: 'created', dispatchedAt: 50 });
  });

  it('rejects ids that do not exist, naming them', () => {
    expect(() => applyDraftOp(seed(), { op: 'set-status', id: ['tk-1', 'tk-nope'], status: 'created' }, ctx())).toThrow(/tk-nope/);
  });
});
