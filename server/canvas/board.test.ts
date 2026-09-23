import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyBoard, mergePos, readBoard, removeCard, sanitizeCard, sanitizePos, updateBoard, upsertCard } from './board';

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
});
