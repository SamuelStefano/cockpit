import { describe, it, expect } from 'vitest';
import { applyDraftOp, draftPoints, isDraftOp, sanitizeDrafts, type DflDraft, type DraftCtx } from './dfl-drafts';

function ctx(now = 1000): DraftCtx {
  let n = 0;
  return { now, newId: (p) => `${p}-${++n}` };
}

const seed = (): DflDraft[] =>
  applyDraftOp([], { op: 'add-epic', title: 'Épico A', tasks: [{ title: 'T1', points: 3, refs: ['LS#1'] }, { title: 'T2', points: 1.5 }] }, ctx());

describe('applyDraftOp', () => {
  it('adds an epic with tasks, status draft and ids', () => {
    const [d] = seed();
    expect(d).toMatchObject({ id: 'ep-3', title: 'Épico A', status: 'draft', createdAt: 1000 });
    expect(d.tasks.map((t) => [t.id, t.title, t.points, t.refs])).toEqual([['tk-1', 'T1', 3, ['LS#1']], ['tk-2', 'T2', 1.5, []]]);
    expect(draftPoints(d)).toBe(4.5);
  });

  it('rejects empty titles and out-of-range points', () => {
    expect(() => applyDraftOp([], { op: 'add-epic', title: '  ' }, ctx())).toThrow(/título/);
    expect(() => applyDraftOp(seed(), { op: 'add-task', epicId: 'ep-3', title: 'x', points: -1 }, ctx())).toThrow(/pontos/);
    expect(() => applyDraftOp(seed(), { op: 'add-task', epicId: 'ep-3', title: 'x', points: Number.NaN }, ctx())).toThrow(/pontos/);
  });

  it('updates a task title and points in place', () => {
    const next = applyDraftOp(seed(), { op: 'update-task', epicId: 'ep-3', taskId: 'tk-2', points: 2 }, ctx());
    expect(next[0].tasks[1]).toMatchObject({ title: 'T2', points: 2 });
    const renamed = applyDraftOp(next, { op: 'update-task', epicId: 'ep-3', taskId: 'tk-1', title: 'T1b' }, ctx());
    expect(renamed[0].tasks[0]).toMatchObject({ title: 'T1b', points: 3 });
  });

  it('fails on unknown epic or task instead of silently doing nothing', () => {
    expect(() => applyDraftOp(seed(), { op: 'delete-task', epicId: 'ep-x', taskId: 'tk-1' }, ctx())).toThrow(/não existe/);
    expect(() => applyDraftOp(seed(), { op: 'update-task', epicId: 'ep-3', taskId: 'tk-9', points: 1 }, ctx())).toThrow(/não existe/);
  });

  it('deletes tasks and epics', () => {
    const noTask = applyDraftOp(seed(), { op: 'delete-task', epicId: 'ep-3', taskId: 'tk-1' }, ctx());
    expect(noTask[0].tasks.map((t) => t.id)).toEqual(['tk-2']);
    expect(applyDraftOp(noTask, { op: 'delete-epic', id: 'ep-3' }, ctx())).toEqual([]);
  });

  it('stamps dispatchedAt once and clears it when going back to draft', () => {
    const sent = applyDraftOp(seed(), { op: 'set-status', id: 'ep-3', status: 'dispatched' }, ctx(2000));
    expect(sent[0]).toMatchObject({ status: 'dispatched', dispatchedAt: 2000 });
    const created = applyDraftOp(sent, { op: 'set-status', id: 'ep-3', status: 'created' }, ctx(3000));
    expect(created[0].dispatchedAt).toBe(2000);
    const back = applyDraftOp(created, { op: 'set-status', id: 'ep-3', status: 'draft' }, ctx(4000));
    expect(back[0].dispatchedAt).toBeUndefined();
    expect(() => applyDraftOp(seed(), { op: 'set-status', id: 'ep-3', status: 'bogus' as never }, ctx())).toThrow(/status/);
  });
});

describe('isDraftOp / sanitizeDrafts', () => {
  it('accepts only known op shapes', () => {
    expect(isDraftOp({ op: 'delete-epic', id: 'x' })).toBe(true);
    expect(isDraftOp({ op: 'rm -rf' })).toBe(false);
    expect(isDraftOp(null)).toBe(false);
  });

  it('drops malformed rows and tasks, defaults unknown status to draft', () => {
    const out = sanitizeDrafts([
      { id: 'ep-1', title: 'ok', status: 'weird', createdAt: 5, tasks: [{ id: 't', title: 'a', points: 2, refs: ['x', 3] }, { id: 'bad', title: 'b', points: 'nope' }] },
      { title: 'no id', tasks: [] },
      'garbage',
    ]);
    expect(out).toEqual([{ id: 'ep-1', title: 'ok', status: 'draft', createdAt: 5, tasks: [{ id: 't', title: 'a', points: 2, refs: ['x'] }] }]);
    expect(sanitizeDrafts({ not: 'an array' })).toEqual([]);
  });
});
