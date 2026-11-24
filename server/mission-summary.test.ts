import { describe, it, expect, vi } from 'vitest';
import type { CanvasCard } from '../shared/canvas';
import { createPlainRunner, missionPlainPrompt, parseMissionPlain, parseMissionPlainResponse, needsPlain, planHash } from './mission-summary';

const card = (id: string, o: Partial<CanvasCard> = {}): CanvasCard => ({
  id, title: `T ${id}`, prompt: 'Do the thing', status: 'todo', kind: 'task',
  contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 5, ...o,
});

describe('parseMissionPlain', () => {
  const ok = '{"title":"Login mais simples","what":"As pessoas entram no app com um toque.","why":"Menos gente desiste."}';
  it('parses a clean JSON answer', () => {
    expect(parseMissionPlain(ok)).toEqual({ title: 'Login mais simples', what: 'As pessoas entram no app com um toque.', why: 'Menos gente desiste.' });
  });
  it('tolerates code fences and chatter', () => {
    expect(parseMissionPlain('Claro!\n```json\n' + ok + '\n```')?.title).toBe('Login mais simples');
  });
  it('rejects invalid JSON, missing fields and non-strings', () => {
    expect(parseMissionPlain('nada')).toBeNull();
    expect(parseMissionPlain('{"title":"a","what":"b"}')).toBeNull();
    expect(parseMissionPlain('{"title":1,"what":"b","why":"c"}')).toBeNull();
    expect(parseMissionPlain('{not json}')).toBeNull();
  });
  it('rejects outputs over the word limits', () => {
    expect(parseMissionPlain(JSON.stringify({ title: 'um dois três quatro cinco seis sete', what: 'b', why: 'c' }))).toBeNull();
    expect(parseMissionPlain(JSON.stringify({ title: 'a', what: 'w '.repeat(19), why: 'c' }))).toBeNull();
    expect(parseMissionPlain(JSON.stringify({ title: 'a', what: 'b', why: 'w '.repeat(16) }))).toBeNull();
  });
});

describe('parseMissionPlainResponse', () => {
  it('reads the text blocks of an API response', () => {
    const json = { content: [{ type: 'text', text: '{"title":"a","what":"b","why":"c"}' }] };
    expect(parseMissionPlainResponse(json)).toEqual({ title: 'a', what: 'b', why: 'c' });
    expect(parseMissionPlainResponse({})).toBeNull();
  });
});

describe('missionPlainPrompt', () => {
  it('includes the title and caps the input', () => {
    const p = missionPlainPrompt({ title: 'My title', prompt: 'x'.repeat(10_000) });
    expect(p).toContain('My title');
    expect(p.length).toBeLessThan(5000);
  });
});

describe('planHash', () => {
  it('depends on title and prompt only, not on updatedAt or status', () => {
    expect(planHash(card('a', { updatedAt: 1 }))).toBe(planHash(card('a', { updatedAt: 99, status: 'doing' })));
    expect(planHash(card('a'))).not.toBe(planHash(card('a', { prompt: 'Do another thing' })));
    expect(planHash(card('a'))).not.toBe(planHash(card('a', { title: 'Other' })));
  });
});

describe('needsPlain', () => {
  it('picks open cards with missing or stale cache only', () => {
    const cards = [card('a'), card('b'), card('c', { prompt: 'changed' }), card('d', { status: 'done' }), card('e', { status: 'doing' })];
    const cache = new Map([['a', { cardUpdatedAt: planHash(card('a')) }], ['c', { cardUpdatedAt: planHash(card('c')) }]]);
    expect(needsPlain(cards, cache, new Map(), 0).map((c) => c.id)).toEqual(['b', 'c', 'e']);
  });
  it('does not regenerate when only updatedAt moved (drag / status change)', () => {
    const cache = new Map([['a', { cardUpdatedAt: planHash(card('a')) }]]);
    expect(needsPlain([card('a', { updatedAt: 500 })], cache, new Map(), 0)).toEqual([]);
  });
  it('backs off recently failed cards', () => {
    const failed = new Map([[`b:${planHash(card('b'))}`, 1000]]);
    expect(needsPlain([card('b')], new Map(), failed, 2000)).toEqual([]);
    expect(needsPlain([card('b')], new Map(), failed, 1000 + 11 * 60_000)).toHaveLength(1);
  });
});

describe('createPlainRunner', () => {
  const plain = { title: 't', what: 'w', why: 'y' };
  const idle = () => new Promise<void>((r) => setTimeout(r, 0));

  it('shares one concurrency limit across enqueue calls', async () => {
    const done: string[] = [];
    let active = 0;
    let peak = 0;
    const generate = async () => {
      active++;
      peak = Math.max(peak, active);
      await idle();
      active--;
      return plain;
    };
    const runner = createPlainRunner({ maxConcurrent: 2, generate, isCached: () => false, save: (c) => { done.push(c.id); }, onFail: () => {} });
    runner.enqueue([card('a'), card('b'), card('c')]);
    runner.enqueue([card('d'), card('e'), card('f')]);
    await vi.waitFor(() => expect(done).toHaveLength(6));
    expect(peak).toBe(2);
  });

  it('re-checks the cache before each call and never generates the same card twice at once', async () => {
    const cached = new Set<string>();
    const generate = vi.fn(async (c: CanvasCard) => {
      await idle();
      return plain;
    });
    const runner = createPlainRunner({
      maxConcurrent: 1,
      generate,
      isCached: (c) => cached.has(c.id),
      save: (c) => { cached.add(c.id); },
      onFail: () => {},
    });
    cached.add('b');
    runner.enqueue([card('a'), card('a'), card('b')]);
    await vi.waitFor(() => expect(cached.has('a')).toBe(true));
    await idle();
    expect(generate.mock.calls.map(([c]) => c.id)).toEqual(['a']);
  });

  it('reports a failed generation', async () => {
    const onFail = vi.fn();
    const runner = createPlainRunner({ maxConcurrent: 1, generate: async () => null, isCached: () => false, save: () => {}, onFail });
    runner.enqueue([card('a')]);
    await vi.waitFor(() => expect(onFail).toHaveBeenCalledWith(`a:${planHash(card('a'))}`));
  });
});
