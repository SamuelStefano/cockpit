import { describe, expect, it } from 'vitest';
import type { CanvasCard } from '../../../shared/canvas';
import { buildMissions, SUMMARY_PENDING } from './missions';

const card = (id: string, o: Partial<CanvasCard> = {}): CanvasCard => ({
  id, title: `Title ${id}`, prompt: 'Do the thing', status: 'todo', kind: 'task',
  contextIds: [], sessionIds: [], createdAt: 1000, updatedAt: 1000, ...o,
});

describe('buildMissions', () => {
  it('returns nothing for an empty board', () => {
    expect(buildMissions([], 0)).toEqual([]);
  });
  it('keeps only todo/doing task and content cards', () => {
    const m = buildMissions([card('a'), card('b', { status: 'done' }), card('c', { status: 'review' }), card('d', { kind: 'content' })], 0);
    expect(m.map((x) => x.id).sort()).toEqual(['a', 'd']);
  });
  it('uses the plain-language summary when present', () => {
    const plain = { title: 'Fix login', what: 'Users return to the page they left.', why: 'Less frustration.' };
    const [m] = buildMissions([card('a', { prompt: 'Refactor useAuth redirect in src/x.ts', plain })], 0);
    expect(m.title).toBe('Fix login');
    expect(m.summary).toBe(plain.what);
    expect(m.why).toBe(plain.why);
    expect(m.description).toBe('Refactor useAuth redirect in src/x.ts');
  });
  it('shows the card title and a placeholder (never the prompt) until plain exists', () => {
    const [m] = buildMissions([card('a', { prompt: 'Refactor useAuth redirect' })], 0);
    expect(m.title).toBe('Title a');
    expect(m.summary).toBe(SUMMARY_PENDING);
    expect(m.why).toBe('');
  });
  it('sizes by prompt length with matching xp', () => {
    const m = buildMissions([card('s', { prompt: 'a'.repeat(299) }), card('m', { prompt: 'a'.repeat(300) }), card('l', { prompt: 'a'.repeat(1200) })], 0);
    const by = Object.fromEntries(m.map((x) => [x.id, x]));
    expect([by.s.size, by.s.xp]).toEqual(['S', 10]);
    expect([by.m.size, by.m.xp]).toEqual(['M', 25]);
    expect([by.l.size, by.l.xp]).toEqual(['L', 50]);
  });
  it('suggests a doing card even when a smaller todo exists', () => {
    const m = buildMissions([card('t'), card('d', { status: 'doing', prompt: 'a'.repeat(2000) })], 0);
    expect(m[0].id).toBe('d');
    expect(m.filter((x) => x.suggested).map((x) => x.id)).toEqual(['d']);
    expect(m[0].reason).toMatch(/in progress/);
    expect(m[1].reason).toBe('');
  });
  it('suggests the smallest, then oldest, todo', () => {
    const m = buildMissions([card('big', { prompt: 'a'.repeat(500), createdAt: 1 }), card('new', { createdAt: 50 }), card('old', { createdAt: 10 })], 0);
    expect(m.map((x) => x.id)).toEqual(['old', 'new', 'big']);
    expect(m[0].suggested).toBe(true);
    expect(m[0].reason).toMatch(/Quick win/);
  });
});
