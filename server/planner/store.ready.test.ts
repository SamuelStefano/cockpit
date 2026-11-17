import { describe, it, expect } from 'vitest';
import type { PlannerTask } from '../../shared/planner';
import { assignOwner, applyHandoff } from '../../shared/task-handoff';
import { applyMoves, readyForbidden, sanitizeTask, setReady } from './store';

const NOW = 1_700_000_000_000;
const base = (over: Partial<PlannerTask> = {}): PlannerTask => ({
  id: 't1', title: 'Fix card', description: 'plain', links: [], difficulty: 1, column: 'today', order: 1, createdAt: NOW, updatedAt: NOW, ...over,
});
const readyTask = (over: Partial<PlannerTask> = {}) => setReady([base(over)], 't1', true, NOW)![0];

describe('ready is human-only', () => {
  it('a client frame carrying ready on a task that is not ready is refused', () => {
    expect(readyForbidden({ ...base(), ready: true }, base())).toBe(true);
    expect(readyForbidden({ ...base(), ready: true }, undefined)).toBe(true);
  });
  it('a round-trip of an already ready task is not a new mark', () => {
    expect(readyForbidden({ ...readyTask() }, readyTask())).toBe(false);
  });
  it('sanitizeTask never takes ready or claim from the client', () => {
    const t = sanitizeTask({ ...base(), ready: true, readyBy: 'human', readyAt: NOW, claim: { botId: 'b', at: NOW } }, base(), NOW)!;
    expect(t.ready).toBeUndefined();
    expect(t.readyBy).toBeUndefined();
    expect(t.claim).toBeUndefined();
  });
  it('setReady stamps readyBy human and readyAt, and clears wantReady', () => {
    const t = setReady([base({ wantReady: { by: 'bot', reason: 'ok', at: NOW } })], 't1', true, NOW + 5)![0];
    expect([t.ready, t.readyBy, t.readyAt, t.wantReady]).toEqual([true, 'human', NOW + 5, undefined]);
  });
  it('setReady refuses a done task', () => {
    expect(setReady([base({ column: 'done' })], 't1', true, NOW)).toBeNull();
  });
});

describe('edits zero ready', () => {
  const edit = (patch: Partial<PlannerTask>) => sanitizeTask({ ...readyTask(), ...patch }, readyTask(), NOW + 1)!;
  it.each([
    ['title', { title: 'Other' }], ['description', { description: 'changed' }],
    ['links', { links: [{ url: 'https://a.com/' }] }], ['owner', { ownerBotId: 'bot-x' }],
    ['sector', { ownerSector: 'growth' as const }], ['unsafe', { unsafe: true as const }],
  ])('editing %s zeroes ready, readyBy and readyAt', (_n, patch) => {
    const t = edit(patch);
    expect([t.ready, t.readyBy, t.readyAt]).toEqual([undefined, undefined, undefined]);
  });
  it('an unchanged save and a column move keep ready', () => {
    expect(edit({}).ready).toBe(true);
    expect(edit({ column: 'week' }).ready).toBe(true);
    const moved = applyMoves([readyTask()], [{ id: 't1', column: 'backlog', order: 2 }], NOW + 1)[0];
    expect(moved.ready).toBe(true);
  });
  it('owner change by assignOwner and handoff zeroes ready', () => {
    expect(assignOwner(readyTask({ ownerBotId: 'a' }), 'b', NOW).ready).toBeUndefined();
    const h = applyHandoff(readyTask({ ownerBotId: 'a' }), { at: NOW, toBotId: 'b', done: 'x', pending: 'y', reason: 'z', switchPoint: 'w' });
    expect(h.ok && h.task.ready).toBeFalsy();
  });
  it('done drops ready', () => {
    expect(applyMoves([readyTask()], [{ id: 't1', column: 'done', order: 1 }], NOW)[0].ready).toBeUndefined();
  });
});

describe('disk round trip', () => {
  it('keeps ready and claim read from disk', () => {
    const disk = { ...readyTask(), claim: { botId: 'bot', at: NOW } };
    const t = sanitizeTask(disk, undefined, NOW, { fromDisk: true })!;
    expect([t.ready, t.readyBy, t.claim?.botId]).toEqual([true, 'human', 'bot']);
  });
});

describe('wantReady', () => {
  const want = (reason: unknown) => sanitizeTask({ ...base(), wantReady: { by: 'zoro', reason } }, base(), NOW)!;
  it('stores a one-line reason up to 140 chars and never sets ready', () => {
    const t = want('looks safe and small');
    expect(t.wantReady).toEqual({ by: 'zoro', reason: 'looks safe and small', at: NOW });
    expect(t.ready).toBeUndefined();
  });
  it('rejects a multi-line, empty or too long reason', () => {
    expect(want('a\nb').wantReady).toBeUndefined();
    expect(want('   ').wantReady).toBeUndefined();
    expect(want('x'.repeat(141)).wantReady).toBeUndefined();
    expect(want('x'.repeat(140)).wantReady).toBeDefined();
  });
  it('null clears it', () => {
    const prev = base({ wantReady: { by: 'a', reason: 'r', at: NOW } });
    expect(sanitizeTask({ ...prev, wantReady: null }, prev, NOW)!.wantReady).toBeUndefined();
  });
});
