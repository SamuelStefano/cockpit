import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PlannerTask } from '../../shared/planner';
import { applyMoves, readTasks, sanitizeTask, updateTasks, upsertTask } from './store';

const base = { id: 't1', title: 'Escrever', column: 'today', order: 1 };

describe('sanitizeTask', () => {
  it('rejects missing title or bad id', () => {
    expect(sanitizeTask({ ...base, title: '  ' }, undefined, 1)).toBeNull();
    expect(sanitizeTask({ ...base, id: 'a b' }, undefined, 1)).toBeNull();
    expect(sanitizeTask(null, undefined, 1)).toBeNull();
  });

  it('clamps title, description and difficulty', () => {
    const t = sanitizeTask({ ...base, title: 'x'.repeat(500), description: 'y'.repeat(9000), difficulty: 9 }, undefined, 1)!;
    expect(t.title).toHaveLength(140);
    expect(t.description).toHaveLength(4000);
    expect(t.difficulty).toBe(3);
    expect(sanitizeTask({ ...base, difficulty: -4 }, undefined, 1)!.difficulty).toBe(1);
    expect(sanitizeTask({ ...base, difficulty: 'abc' }, undefined, 1)!.difficulty).toBe(1);
  });

  it('sends unknown column to backlog', () => {
    expect(sanitizeTask({ ...base, column: 'nope' }, undefined, 1)!.column).toBe('backlog');
  });

  it('keeps only http(s) links, max 10', () => {
    const links = [
      { url: 'javascript:alert(1)' }, { url: 'ftp://x.com' }, { url: 'not a url' },
      { url: 'https://ok.dev/a', label: ' Docs ' }, { url: 'http://ok.dev' },
      ...Array.from({ length: 20 }, (_, i) => ({ url: `https://x.dev/${i}` })),
    ];
    const t = sanitizeTask({ ...base, links }, undefined, 1)!;
    expect(t.links).toHaveLength(10);
    expect(t.links[0]).toEqual({ url: 'https://ok.dev/a', label: 'Docs' });
    expect(t.links.every((l) => /^https?:/.test(l.url))).toBe(true);
  });

  it('sets doneAt on entering done and keeps createdAt', () => {
    const prev = sanitizeTask(base, undefined, 10)!;
    const done = sanitizeTask({ ...base, column: 'done' }, prev, 50)!;
    expect(done.doneAt).toBe(50);
    expect(done.createdAt).toBe(10);
    expect(done.updatedAt).toBe(50);
    expect(sanitizeTask({ ...base, column: 'done' }, done, 90)!.doneAt).toBe(50);
    expect(sanitizeTask(base, done, 99)!.doneAt).toBeUndefined();
  });
});

describe('sanitizeTask source', () => {
  it('keeps source only when exactly agent', () => {
    expect(sanitizeTask({ ...base, source: 'agent' }, undefined, 1)!.source).toBe('agent');
    expect(sanitizeTask({ ...base, source: 'bot' }, undefined, 1)!.source).toBeUndefined();
  });

  it('keeps the previous source when an edit omits it', () => {
    const prev = sanitizeTask({ ...base, source: 'agent' }, undefined, 1)!;
    expect(sanitizeTask(base, prev, 2)!.source).toBe('agent');
    expect(sanitizeTask({ ...base, source: 'x' }, prev, 2)!.source).toBe('agent');
  });
});

describe('applyMoves / upsertTask', () => {
  const a = sanitizeTask({ ...base, id: 'a' }, undefined, 1)!;
  const b = sanitizeTask({ ...base, id: 'b', order: 2 }, undefined, 1)!;

  it('moves tasks, stamps doneAt, ignores junk', () => {
    const out = applyMoves([a, b], [{ id: 'a', column: 'done', order: 5 }, { id: 'zz', column: 'week', order: 1 }, { id: 'b', column: 'bad', order: 1 }], 100);
    expect(out[0]).toMatchObject({ column: 'done', order: 5, doneAt: 100 });
    expect(out[1]).toEqual(b);
    expect(applyMoves(out, [{ id: 'a', column: 'week', order: 1 }], 200)[0].doneAt).toBeUndefined();
  });

  it('caps the task count at 1000', () => {
    const many: PlannerTask[] = Array.from({ length: 1000 }, (_, i) => ({ ...a, id: `t${i}` }));
    expect(upsertTask(many, { ...a, id: 'extra' })).toBeNull();
    expect(upsertTask(many, { ...a, id: 't3', title: 'novo' })).toHaveLength(1000);
  });
});

describe('file persistence', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'planner-'));
    process.env.COCKPIT_PLANNER = join(dir, 'planner.json');
  });
  afterEach(async () => {
    delete process.env.COCKPIT_PLANNER;
    await rm(dir, { recursive: true, force: true });
  });

  it('reads empty when missing and round-trips writes', async () => {
    expect(await readTasks()).toEqual([]);
    const t = sanitizeTask(base, undefined, 5)!;
    await updateTasks((l) => upsertTask(l, t)!);
    expect(await readTasks()).toEqual([t]);
  });

  it('serializes concurrent writes', async () => {
    await Promise.all(['a', 'b', 'c'].map((id) => updateTasks((l) => upsertTask(l, sanitizeTask({ ...base, id }, undefined, 5)!)!)));
    expect((await readTasks()).map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
