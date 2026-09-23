import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bumpFlowFired, emptyBoard, markCardDoing, mergePos, readBoard, readBoardChained, removeCard, removeFlow,
  sanitizeCard, sanitizeFlow, sanitizePos, updateBoard, upsertCard, upsertFlow,
} from './board';

describe('sanitizeCard', () => {
  it('rejects a bad id or empty title', () => {
    expect(sanitizeCard({ id: '../x', title: 'a' }, undefined, 1)).toBeNull();
    expect(sanitizeCard({ id: 'abcd', title: '  ' }, undefined, 1)).toBeNull();
  });

  it('normalizes fields and keeps createdAt from the previous version', () => {
    const c = sanitizeCard({
      id: 'abcd', title: 'a\nb', status: 'weird', kind: 'content', format: 'post',
      contextIds: ['ok', 'ok', '../bad', 3], sessionIds: 'nope',
    }, { createdAt: 7 } as never, 9);
    expect(c).toMatchObject({ title: 'a b', status: 'todo', kind: 'content', format: 'post', contextIds: ['ok'], sessionIds: [], createdAt: 7, updatedAt: 9 });
  });

  it('drops format on task cards', () => {
    expect(sanitizeCard({ id: 'abcd', title: 'a', format: 'post' }, undefined, 1)?.format).toBeUndefined();
  });
});

describe('sanitizeFlow', () => {
  it('rejects a bad id, a non-session/card endpoint, or a self-loop', () => {
    expect(sanitizeFlow({ id: '../x', from: 's:a', to: 'k:b' }, undefined, 1)).toBeNull();
    expect(sanitizeFlow({ id: 'abcd', from: 'c:a', to: 'k:b' }, undefined, 1)).toBeNull();
    expect(sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:a' }, undefined, 1)).toBeNull();
  });

  it('normalizes fields, defaults enabled to true, and keeps createdAt/fires from the previous version', () => {
    const f = sanitizeFlow(
      { id: 'abcd', from: 's:a', to: 'k:b', template: 'oi {{result}}' },
      { createdAt: 7, fires: 3, lastFiredAt: 100 } as never,
      9,
    );
    expect(f).toMatchObject({ id: 'abcd', from: 's:a', to: 'k:b', template: 'oi {{result}}', enabled: true, createdAt: 7, fires: 3, lastFiredAt: 100 });
  });

  it('caps the template length and coerces enabled/fires from raw input', () => {
    const long = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:b', template: 'x'.repeat(5000), enabled: false, fires: 2.9 }, undefined, 1)!;
    expect(long.template.length).toBe(4000);
    expect(long.enabled).toBe(false);
    expect(long.fires).toBe(2);
  });
});

describe('flow board ops', () => {
  it('upserts, caps at MAX_FLOWS is respected on insert-only, and removes', () => {
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:b' }, undefined, 1)!;
    let b = upsertFlow(emptyBoard(), f);
    expect(b.flows.map((x) => x.id)).toEqual(['abcd']);
    const f2 = { ...f, template: 'novo' };
    b = upsertFlow(b, f2);
    expect(b.flows).toEqual([f2]);
    b = removeFlow(b, 'abcd');
    expect(b.flows).toEqual([]);
  });

  it('bumpFlowFired increments fires and stamps lastFiredAt, no-op on unknown id', () => {
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:b' }, undefined, 1)!;
    let b = upsertFlow(emptyBoard(), f);
    b = bumpFlowFired(b, 'abcd', 500);
    expect(b.flows[0]).toMatchObject({ fires: 1, lastFiredAt: 500 });
    const same = bumpFlowFired(b, 'nope', 999);
    expect(same).toBe(b);
  });

  it('markCardDoing moves the card and stamps updatedAt, no-op on unknown id', () => {
    const c = sanitizeCard({ id: 'abcd', title: 'a' }, undefined, 1)!;
    let b = upsertCard(emptyBoard(), c);
    b = markCardDoing(b, 'abcd', 42);
    expect(b.cards[0]).toMatchObject({ status: 'doing', updatedAt: 42 });
    expect(markCardDoing(b, 'nope', 1)).toBe(b);
  });
});

describe('positions', () => {
  it('keeps only well-formed node ids and finite coords', () => {
    expect(sanitizePos({ 'c:a': { x: 1.4, y: 2 }, 'x:a': { x: 1, y: 1 }, 'k:b': { x: NaN, y: 1 } })).toEqual({ 'c:a': { x: 1, y: 2 } });
  });

  it('merges and removes a card with its position', () => {
    let b = mergePos(emptyBoard(), { 'k:abcd': { x: 1, y: 1 } });
    b = upsertCard(b, sanitizeCard({ id: 'abcd', title: 'a' }, undefined, 1)!);
    b = removeCard(b, 'abcd');
    expect(b).toEqual(emptyBoard());
  });
});

describe('updateBoard', () => {
  beforeEach(() => { process.env.COCKPIT_CANVAS_BOARD = join(mkdtempSync(join(tmpdir(), 'canvas-')), 'b.json'); });

  it('serializes concurrent writes', async () => {
    const a = sanitizeCard({ id: 'aaaa', title: 'a' }, undefined, 1)!;
    const b = sanitizeCard({ id: 'bbbb', title: 'b' }, undefined, 1)!;
    await Promise.all([updateBoard((x) => upsertCard(x, a)), updateBoard((x) => upsertCard(x, b))]);
    expect((await readBoard()).cards.map((c) => c.id).sort()).toEqual(['aaaa', 'bbbb']);
  });

  it('treats a missing file as empty, but a corrupt one as an error, not empty', async () => {
    await expect(readBoard()).resolves.toEqual(emptyBoard()); // ENOENT
    writeFileSync(process.env.COCKPIT_CANVAS_BOARD!, '{not json');
    await expect(readBoard()).rejects.toBeInstanceOf(SyntaxError);
  });

  it('loads a pre-flows board (no `flows` key on disk) with flows: []', async () => {
    writeFileSync(process.env.COCKPIT_CANVAS_BOARD!, JSON.stringify({ cards: [], pos: {} }));
    await expect(readBoard()).resolves.toEqual(emptyBoard());
  });

  it('a read failure during updateBoard rejects and never wipes the file on disk', async () => {
    const a = sanitizeCard({ id: 'aaaa', title: 'a' }, undefined, 1)!;
    await updateBoard((x) => upsertCard(x, a));
    writeFileSync(process.env.COCKPIT_CANVAS_BOARD!, '{not json');
    await expect(updateBoard((x) => x)).rejects.toBeInstanceOf(SyntaxError);
    expect(readFileSync(process.env.COCKPIT_CANVAS_BOARD!, 'utf8')).toBe('{not json');
    // the chain recovers for the next caller once the file is fixed
    const b = sanitizeCard({ id: 'bbbb', title: 'b' }, undefined, 1)!;
    writeFileSync(process.env.COCKPIT_CANVAS_BOARD!, JSON.stringify(emptyBoard()));
    await updateBoard((x) => upsertCard(x, b));
    expect((await readBoard()).cards.map((c) => c.id)).toEqual(['bbbb']);
  });

  it('readBoardChained waits for a write already queued ahead of it', async () => {
    const a = sanitizeCard({ id: 'aaaa', title: 'a' }, undefined, 1)!;
    const write = updateBoard((x) => upsertCard(x, a));
    const read = readBoardChained();
    await write;
    expect((await read).cards.map((c) => c.id)).toEqual(['aaaa']);
  });

  it('keeps a .bak of the board before each write', async () => {
    const a = sanitizeCard({ id: 'aaaa', title: 'a' }, undefined, 1)!;
    await updateBoard((x) => upsertCard(x, a));
    const b = sanitizeCard({ id: 'bbbb', title: 'b' }, undefined, 1)!;
    await updateBoard((x) => upsertCard(x, b));
    const bak = JSON.parse(readFileSync(`${process.env.COCKPIT_CANVAS_BOARD!}.bak`, 'utf8'));
    expect(bak.cards.map((c: { id: string }) => c.id)).toEqual(['aaaa']);
  });
});
