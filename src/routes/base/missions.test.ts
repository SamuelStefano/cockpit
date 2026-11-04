import { describe, expect, it } from 'vitest';
import type { CanvasCard } from '../../../shared/canvas';
import { buildMissions } from './missions';

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
  it('summarizes the first meaningful line, clipped to 90 chars', () => {
    const m = buildMissions([card('a', { prompt: '\n\n## Fix the login redirect\nmore' }), card('b', { prompt: 'x'.repeat(200) }), card('c', { prompt: '  \n ' })], 0);
    const by = Object.fromEntries(m.map((x) => [x.id, x]));
    expect(by.a.summary).toBe('Fix the login redirect');
    expect(by.b.summary.length).toBeLessThanOrEqual(90);
    expect(by.c.summary).toBe('Title c');
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
