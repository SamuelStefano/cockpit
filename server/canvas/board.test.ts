import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkFlowSave, claimFlowFire, emptyBoard, markCardDoing, mergePos, readBoard, readBoardChained, removeCard, removeFlow,
  rollbackFlowFire, sanitizeCard, sanitizeFlow, sanitizePos, updateBoard, upsertCard, upsertFlow,
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

  it('normalizes fields, defaults enabled to true, and keeps createdAt/fires/lastFiredAt from the previous version', () => {
    const f = sanitizeFlow(
      { id: 'abcd', from: 's:a', to: 'k:b', template: 'oi {{result}}' },
      { createdAt: 7, fires: 3, lastFiredAt: 100 } as never,
      9,
    );
    expect(f).toMatchObject({ id: 'abcd', from: 's:a', to: 'k:b', template: 'oi {{result}}', enabled: true, createdAt: 7, fires: 3, lastFiredAt: 100 });
  });

  it('fires/lastFiredAt are server-owned: a client-sent value is ignored even with no previous version', () => {
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:b', fires: 999, lastFiredAt: 123 }, undefined, 1)!;
    expect(f.fires).toBe(0);
    expect(f.lastFiredAt).toBeUndefined();
  });

  it('fires/lastFiredAt cannot be forged upward even when editing an existing flow', () => {
    const prev = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:b' }, undefined, 1)!;
    const claimed = claimFlowFire(upsertFlow(emptyBoard(), prev), 'abcd', 500, 60_000);
    const stored = claimed.board.flows[0];
    // client "saves" with a forged fires/lastFiredAt in the raw payload
    const saved = sanitizeFlow({ ...stored, template: 'novo texto', fires: 0, lastFiredAt: undefined }, stored, 9000);
    expect(saved).toMatchObject({ template: 'novo texto', fires: 1, lastFiredAt: 500 });
  });

  it('caps the template length, coerces enabled from raw input, and validates mode/mcps', () => {
    const long = sanitizeFlow(
      { id: 'abcd', from: 's:a', to: 'k:b', template: 'x'.repeat(5000), enabled: false, mode: 'acceptEdits', mcps: ['dfl-mcp', 'bad name', 'dfl-mcp', 42] },
      undefined, 1,
    )!;
    expect(long.template.length).toBe(4000);
    expect(long.enabled).toBe(false);
    expect(long.mode).toBe('acceptEdits');
    expect(long.mcps).toEqual(['dfl-mcp']);
  });

  it('rejects an invalid mode and defaults mcps to unset', () => {
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:b', mode: 'bypassPermissions' }, undefined, 1)!;
    expect(f.mode).toBeUndefined();
    expect(f.mcps).toBeUndefined();
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

  it('checkFlowSave rejects a duplicate from/to pair (excluding self) and a new flow past MAX_FLOWS', () => {
    const a = sanitizeFlow({ id: 'aaaa', from: 's:a', to: 'k:b' }, undefined, 1)!;
    const b = upsertFlow(emptyBoard(), a);
    expect(checkFlowSave(b, sanitizeFlow({ id: 'bbbb', from: 's:a', to: 'k:b' }, undefined, 1)!)).toBe('duplicado');
    expect(checkFlowSave(b, { ...a, template: 'edit' })).toBeNull(); // editing itself is not a duplicate
    const full = { ...emptyBoard(), flows: Array.from({ length: 100 }, (_, i) => ({ ...a, id: `f${i}`, to: `k:${i}` })) };
    expect(checkFlowSave(full, sanitizeFlow({ id: 'new1', from: 's:a', to: 'k:zzz' }, undefined, 1)!)).toBe('limite');
  });

  it('claimFlowFire bumps fires/lastFiredAt atomically and refuses a disabled, cooling-down, or unknown flow', () => {
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:b' }, undefined, 1)!;
    let b = upsertFlow(emptyBoard(), f);
    const first = claimFlowFire(b, 'abcd', 500, 60_000);
    expect(first.claimed).toBe(true);
    expect(first.board.flows[0]).toMatchObject({ fires: 1, lastFiredAt: 500 });
    const cooling = claimFlowFire(first.board, 'abcd', 500 + 59_999, 60_000);
    expect(cooling.claimed).toBe(false);
    expect(cooling.board).toBe(first.board);
    const pastCooldown = claimFlowFire(first.board, 'abcd', 500 + 60_000, 60_000);
    expect(pastCooldown.claimed).toBe(true);
    expect(pastCooldown.board.flows[0]).toMatchObject({ fires: 2, lastFiredAt: 60_500 });
    const disabled = upsertFlow(emptyBoard(), { ...f, enabled: false });
    expect(claimFlowFire(disabled, 'abcd', 1, 60_000).claimed).toBe(false);
    expect(claimFlowFire(b, 'nope', 1, 60_000).claimed).toBe(false);
  });

  it('rollbackFlowFire undoes a claim (fires -1, lastFiredAt cleared) only when it still matches the claimed timestamp', () => {
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:b' }, undefined, 1)!;
    const claimed = claimFlowFire(upsertFlow(emptyBoard(), f), 'abcd', 500, 60_000).board;
    const rolledBack = rollbackFlowFire(claimed, 'abcd', 500);
    expect(rolledBack.flows[0]).toMatchObject({ fires: 0, lastFiredAt: undefined });
    // a newer claim landed since — rollback of the stale timestamp is a no-op
    const superseded = rollbackFlowFire(claimed, 'abcd', 499);
    expect(superseded).toBe(claimed);
  });

  it('markCardDoing moves the card and stamps updatedAt, no-op on unknown id', () => {
    const c = sanitizeCard({ id: 'abcd', title: 'a' }, undefined, 1)!;
    let b = upsertCard(emptyBoard(), c);
    b = markCardDoing(b, 'abcd', 42);
    expect(b.cards[0]).toMatchObject({ status: 'doing', updatedAt: 42 });
    expect(markCardDoing(b, 'nope', 1)).toBe(b);
  });

  it('removeCard drops flows bound to that card (either end) but leaves unrelated ones', () => {
    const bound1 = sanitizeFlow({ id: 'aaaa', from: 'k:abcd', to: 's:x' }, undefined, 1)!;
    const bound2 = sanitizeFlow({ id: 'bbbb', from: 's:x', to: 'k:abcd' }, undefined, 1)!;
    const other = sanitizeFlow({ id: 'cccc', from: 's:x', to: 'k:other' }, undefined, 1)!;
    const c = sanitizeCard({ id: 'abcd', title: 'a' }, undefined, 1)!;
    let b = upsertCard(emptyBoard(), c);
    b = upsertFlow(upsertFlow(upsertFlow(b, bound1), bound2), other);
    b = removeCard(b, 'abcd');
    expect(b.flows.map((f) => f.id)).toEqual(['cccc']);
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
