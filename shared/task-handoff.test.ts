import { describe, expect, it } from 'vitest';
import type { PlannerTask, TaskHandoff } from './planner';
import { applyHandoff, assignOwner, handoffNote, sanitizeHandoffs } from './task-handoff';

const task: PlannerTask = { id: 't1', title: 'T', description: '', links: [], difficulty: 1, column: 'today', order: 1, createdAt: 1, updatedAt: 1 };
const h = (o: Partial<TaskHandoff> = {}): TaskHandoff => ({ at: 10, toBotId: 'b', done: 'd', pending: 'p', reason: 'r', switchPoint: 's', ...o });
const names: Record<string, string> = { a: 'Ana', b: 'Beto' };
const nameOf = (id: string) => names[id] ?? id;

describe('assignOwner', () => {
  it('sets and clears the owner', () => {
    const owned = assignOwner(task, 'a', 5);
    expect(owned.ownerBotId).toBe('a');
    expect(owned.updatedAt).toBe(5);
    expect('ownerBotId' in assignOwner(owned, undefined, 6)).toBe(false);
  });
});

describe('applyHandoff', () => {
  it('moves ownership and appends history', () => {
    const r = applyHandoff({ ...task, ownerBotId: 'a' }, h({ fromBotId: 'a' }));
    expect(r.ok && r.task.ownerBotId).toBe('b');
    expect(r.ok && r.task.handoffs).toHaveLength(1);
  });
  it('rejects empty fields and the current owner', () => {
    for (const f of ['done', 'pending', 'reason', 'switchPoint'] as const) {
      expect(applyHandoff(task, h({ [f]: '  ' })).ok).toBe(false);
    }
    expect(applyHandoff({ ...task, ownerBotId: 'b' }, h()).ok).toBe(false);
  });
  it('trims text to 600 chars and caps history at 20', () => {
    const r = applyHandoff(task, h({ done: 'x'.repeat(900) }));
    expect(r.ok && r.task.handoffs?.[0].done).toHaveLength(600);
    let t: PlannerTask = { ...task, handoffs: Array.from({ length: 20 }, (_, i) => h({ at: i })) };
    const next = applyHandoff(t, h({ at: 99 }));
    t = next.ok ? next.task : t;
    expect(t.handoffs).toHaveLength(20);
    expect(t.handoffs?.[19].at).toBe(99);
    expect(t.handoffs?.[0].at).toBe(1);
  });
});

describe('sanitizeHandoffs', () => {
  it('drops malformed entries and unknown fields', () => {
    const out = sanitizeHandoffs([h({ fromBotId: 'a' }), { ...h(), extra: 1 }, { ...h(), done: '' }, null, 'x']);
    expect(out).toHaveLength(2);
    expect('extra' in out[1]).toBe(false);
  });
  it('returns [] for a non-array', () => {
    expect(sanitizeHandoffs({})).toEqual([]);
  });
});

describe('handoffNote', () => {
  it('renders four labelled lines under a header', () => {
    expect(handoffNote(h({ fromBotId: 'a' }), nameOf).split('\n')).toEqual([
      'Ana passou para Beto', 'Feito: d', 'Falta: p', 'Por que troca de mão: r', 'Ponto da troca: s',
    ]);
  });
});
