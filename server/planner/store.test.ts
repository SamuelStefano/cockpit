import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PlannerTask } from '../../shared/planner';
import { applyMoves, markReady, readTasks, readyAttempt, sanitizeTask, updateTasks, upsertTask } from './store';

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

describe('sanitizeTask ref and tag', () => {
  it('keeps a valid ref and a trimmed, clamped tag', () => {
    const t = sanitizeTask({ ...base, ref: ' DFL-01498 ', tag: '  Tainan  ' }, undefined, 1)!;
    expect(t.ref).toBe('DFL-01498');
    expect(t.tag).toBe('Tainan');
    expect(sanitizeTask({ ...base, ref: 'placar:3f9a-1c2e' }, undefined, 1)!.ref).toBe('placar:3f9a-1c2e');
    expect(sanitizeTask({ ...base, tag: 'x'.repeat(50) }, undefined, 1)!.tag).toHaveLength(24);
  });

  it('drops an invalid ref and an empty tag', () => {
    expect(sanitizeTask({ ...base, ref: 'has space' }, undefined, 1)!.ref).toBeUndefined();
    expect(sanitizeTask({ ...base, ref: 'x'.repeat(81) }, undefined, 1)!.ref).toBeUndefined();
    expect(sanitizeTask({ ...base, tag: '   ' }, undefined, 1)!.tag).toBeUndefined();
    expect(sanitizeTask({ ...base, tag: 7 }, undefined, 1)!.tag).toBeUndefined();
  });

  it('keeps previous values when the raw omits them, clears on an explicit empty value', () => {
    const prev = sanitizeTask({ ...base, ref: 'DFL-1', tag: 'DFL' }, undefined, 1)!;
    expect(sanitizeTask(base, prev, 2)).toMatchObject({ ref: 'DFL-1', tag: 'DFL' });
    expect(sanitizeTask({ ...base, tag: '' }, prev, 2)!.tag).toBeUndefined();
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

describe('sanitizeTask owner and handoffs', () => {
  const ho = { at: 5, toBotId: 'b', done: 'd', pending: 'p', reason: 'r', switchPoint: 's' };

  it('keeps a valid owner, drops a malformed one, clears on empty', () => {
    expect(sanitizeTask({ ...base, ownerBotId: 'bot-1' }, undefined, 1)!.ownerBotId).toBe('bot-1');
    expect(sanitizeTask({ ...base, ownerBotId: 'a b' }, undefined, 1)!.ownerBotId).toBeUndefined();
    const prev = sanitizeTask({ ...base, ownerBotId: 'bot-1' }, undefined, 1)!;
    expect(sanitizeTask(base, prev, 2)!.ownerBotId).toBe('bot-1');
    expect(sanitizeTask({ ...base, ownerBotId: '' }, prev, 2)!.ownerBotId).toBeUndefined();
  });

  it('drops malformed handoffs and unknown fields when parsing without history', () => {
    const t = sanitizeTask({ ...base, handoffs: [{ ...ho, extra: 1 }, { ...ho, done: '' }, 'x'] }, undefined, 1)!;
    expect(t.handoffs).toEqual([ho]);
  });

  it('never lets a client frame rewrite existing history', () => {
    const prev = sanitizeTask({ ...base, handoffs: [ho] }, undefined, 1)!;
    expect(sanitizeTask({ ...base, handoffs: [] }, prev, 2)!.handoffs).toEqual([ho]);
  });
});

describe('village fields', () => {
  const claim = { botId: 'bob', at: 5 };
  const human = { human: 'box:dev1' };
  const rb = { readyBy: 'human:box:dev1', readyAt: 9 };
  const trusted = { trusted: true };

  it('round-trips ready, unsafe, ownerSector and claim from disk (trusted)', () => {
    const t = sanitizeTask({ ...base, ready: true, ...rb, unsafe: true, ownerSector: 'growth', ownerBotId: 'bob', claim }, undefined, 1, trusted)!;
    expect(t).toMatchObject({ ready: true, ...rb, unsafe: true, ownerSector: 'growth', ownerBotId: 'bob', claim });
  });

  it('drops invalid values', () => {
    const t = sanitizeTask({ ...base, ready: 'yes', unsafe: 1, ownerSector: 'sales', claim: { botId: 'bad id', at: 5 } }, undefined, 1, trusted)!;
    expect(t.ready).toBeUndefined();
    expect(t.unsafe).toBeUndefined();
    expect(t.ownerSector).toBeUndefined();
    expect(t.claim).toBeUndefined();
    expect(sanitizeTask({ ...base, claim: { botId: 'bob', at: -1 } }, undefined, 1, trusted)!.claim).toBeUndefined();
  });

  it('never takes a claim from a client, for new or existing tasks', () => {
    expect(sanitizeTask({ ...base, claim }, undefined, 1)!.claim).toBeUndefined();
    expect(sanitizeTask({ ...base, claim }, undefined, 1, human)!.claim).toBeUndefined();
    const prev = sanitizeTask({ ...base }, undefined, 1)!;
    expect(sanitizeTask({ ...base, claim }, prev, 2, human)!.claim).toBeUndefined();
  });

  it('keeps the stored claim on an unrelated edit but clears it when owner or sector changes', () => {
    const prev = sanitizeTask({ ...base, ownerBotId: 'bob', ownerSector: 'growth', claim }, undefined, 1, trusted)!;
    expect(sanitizeTask({ ...base }, prev, 2)!.claim).toEqual(claim);
    expect(sanitizeTask({ ...base, ownerBotId: 'alice' }, prev, 2)!.claim).toBeUndefined();
    expect(sanitizeTask({ ...base, ownerBotId: 'none!' }, prev, 2)!.claim).toBeUndefined();
    expect(sanitizeTask({ ...base, ownerSector: 'engineering' }, prev, 2)!.claim).toBeUndefined();
    expect(sanitizeTask({ ...base, ownerSector: null }, prev, 2)!.claim).toBeUndefined();
  });

  it('a client may set unsafe and unset ready freely', () => {
    const prev = sanitizeTask({ ...base, ready: true, ...rb }, undefined, 1, trusted)!;
    const t = sanitizeTask({ ...base, ready: false, unsafe: true }, prev, 2)!;
    expect(t.ready).toBeUndefined();
    expect(t.unsafe).toBe(true);
  });

  it('a save never sets ready: not for anyone, even with a human identity or forged readyBy', () => {
    const prev = sanitizeTask({ ...base }, undefined, 1)!;
    for (const opts of [undefined, human]) {
      expect(sanitizeTask({ ...base, ready: true, ...rb }, prev, 2, opts)!.ready).toBeUndefined();
      expect(readyAttempt({ ...base, ready: true }, prev)).toBe(true);
    }
    expect(readyAttempt({ ...base, ready: true }, { ...prev, ready: true })).toBe(false);
  });

  it('markReady stamps readyBy from the verified identity, refuses unsafe, risky and done tasks', () => {
    const t = sanitizeTask({ ...base }, undefined, 1)!;
    expect(markReady(t, 'box:dev1', 5)).toMatchObject({ ok: true, task: { ready: true, readyBy: 'human:box:dev1', readyAt: 5 } });
    expect(markReady(t, 'bad id!', 5)).toMatchObject({ ok: false });
    expect(markReady({ ...t, unsafe: true }, 'box:dev1', 5)).toMatchObject({ ok: false });
    expect(markReady({ ...t, title: 'Corrigir Produção' }, 'box:dev1', 5)).toMatchObject({ ok: false });
    expect(markReady({ ...t, column: 'done' }, 'box:dev1', 5)).toMatchObject({ ok: false });
  });

  it('keeps the unsafe flag unless a human identity clears it', () => {
    const prev = sanitizeTask({ ...base }, undefined, 1)!;
    const sealed = sanitizeTask({ ...base, unsafe: true }, prev, 2)!;
    expect(sanitizeTask({ ...base, unsafe: false }, sealed, 3)!.unsafe).toBe(true);
    expect(sanitizeTask({ ...base, unsafe: false }, sealed, 3, human)!.unsafe).toBeUndefined();
    expect(sanitizeTask({ ...base }, sealed, 3)!.unsafe).toBe(true);
  });

  it('drops a disk task marked ready without a human readyBy', () => {
    expect(sanitizeTask({ ...base, ready: true }, undefined, 1, trusted)!.ready).toBeUndefined();
    expect(sanitizeTask({ ...base, ready: true, readyBy: 'bot:x', readyAt: 1 }, undefined, 1, trusted)!.ready).toBeUndefined();
  });

  it('keeps ready when an edit omits it and clears sector on null', () => {
    const prev = sanitizeTask({ ...base, ready: true, ...rb, ownerSector: 'growth' }, undefined, 1, trusted)!;
    expect(sanitizeTask({ ...base }, prev, 2)).toMatchObject({ ready: true, ...rb, ownerSector: 'growth' });
    expect(sanitizeTask({ ...base, ownerSector: null }, prev, 2)!.ready).toBeUndefined();
  });

  it('wantReady: single line, max 140, stable timestamp, never grants ready', () => {
    const t = sanitizeTask({ ...base, wantReady: { by: 'luffy', reason: 'a\r\nb', at: 99 } }, undefined, 5)!;
    expect(t.wantReady).toEqual({ by: 'luffy', reason: 'a b', at: 5 });
    expect(t.ready).toBeUndefined();
    expect(sanitizeTask({ ...base, wantReady: { by: 'luffy', reason: 'x'.repeat(200), at: 1 } }, undefined, 5)!.wantReady!.reason).toHaveLength(140);
    expect(sanitizeTask({ ...base, wantReady: { by: 'luffy', reason: '  ', at: 1 } }, undefined, 5)!.wantReady).toBeUndefined();
    expect(sanitizeTask({ ...base, wantReady: { by: 'luffy', reason: 'a b', at: 1 } }, t, 8)!.wantReady!.at).toBe(5);
    expect(sanitizeTask({ ...base }, t, 8)!.wantReady).toEqual(t.wantReady);
  });

  it('completing a task clears claim and ready, by save and by move', () => {
    const prev = sanitizeTask({ ...base, ready: true, ...rb, claim }, undefined, 1, trusted)!;
    const done = sanitizeTask({ ...base, column: 'done', ready: true }, prev, 2, human)!;
    expect(done.claim).toBeUndefined();
    expect(done.ready).toBeUndefined();
    const moved = applyMoves([prev], [{ id: 't1', column: 'done', order: 1 }], 3)[0];
    expect(moved.claim).toBeUndefined();
    expect(moved.ready).toBeUndefined();
  });
});
