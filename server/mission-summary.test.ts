import { describe, it, expect } from 'vitest';
import type { CanvasCard } from '../shared/canvas';
import { missionPlainPrompt, parseMissionPlain, parseMissionPlainResponse, needsPlain } from './mission-summary';

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

describe('needsPlain', () => {
  it('picks open cards with missing or stale cache only', () => {
    const cards = [card('a'), card('b'), card('c', { updatedAt: 9 }), card('d', { status: 'done' }), card('e', { status: 'doing' })];
    const cache = new Map([['a', { cardUpdatedAt: 5 }], ['c', { cardUpdatedAt: 5 }]]);
    expect(needsPlain(cards, cache, new Map(), 0).map((c) => c.id)).toEqual(['b', 'c', 'e']);
  });
  it('backs off recently failed cards', () => {
    const failed = new Map([['b:5', 1000]]);
    expect(needsPlain([card('b')], new Map(), failed, 2000)).toEqual([]);
    expect(needsPlain([card('b')], new Map(), failed, 1000 + 11 * 60_000)).toHaveLength(1);
  });
});
