import { describe, it, expect } from 'vitest';
import type { SessionMeta } from '../../shared/protocol';
import type { CanvasCard } from '../../shared/canvas';
import { buildCanvasGraph, linkKey, originSession, wikilinks, type ContextDoc } from './graph';

const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';

const meta = (id: string, title = 't'): SessionMeta => ({ id, title, relative: '', snippet: 'snip', mtime: 1, count: 1 });
const ctx = (id: string, extra: Partial<ContextDoc> = {}): ContextDoc => ({
  id, name: id.replace(/_/g, '-'), title: id, description: 'd', mtime: 1, links: [], path: `/m/${id}.md`, ...extra,
});
const card = (id: string, extra: Partial<CanvasCard> = {}): CanvasCard => ({
  id, title: 'c', prompt: 'p', status: 'todo', kind: 'task', contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 1, ...extra,
});

describe('wikilinks / linkKey / originSession', () => {
  it('extracts link targets without alias or anchor', () => {
    expect(wikilinks('see [[hub_deck]] and [[deck-todo|alias]] and [[x#sec]]')).toEqual(['hub_deck', 'deck-todo', 'x']);
  });
  it('treats - and _ as the same', () => {
    expect(linkKey('Hub-Deck')).toBe(linkKey('hub_deck'));
  });
  it('reads the origin session from frontmatter', () => {
    expect(originSession(`---\nmetadata:\n  originSessionId: ${S1}\n---`)).toBe(S1);
    expect(originSession('---\nname: x\n---')).toBeUndefined();
  });
});

describe('buildCanvasGraph', () => {
  it('wires sessions to the contexts they touched and hubs to leaves', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: { deck_todo: 'write', gone: 'read' }, consumed: 0 }]]),
      contexts: [ctx('hub_deck', { links: ['deck-todo'] }), ctx('deck_todo')],
      cards: [],
      now: 5,
    });
    expect(g.edges).toEqual([
      { source: `s:${S1}`, target: 'c:deck_todo', kind: 'write' },
      { source: 'c:hub_deck', target: 'c:deck_todo', kind: 'link' },
    ]);
    expect(g.nodes.find((n) => n.id === 'c:hub_deck')?.hub).toBe(true);
  });

  it('links a context to the session that wrote it via originSessionId', () => {
    const g = buildCanvasGraph({ sessions: [{ meta: meta(S2), archived: true }], refs: new Map(), contexts: [ctx('a', { origin: S2 })], cards: [] });
    expect(g.edges).toEqual([{ source: `s:${S2}`, target: 'c:a', kind: 'write' }]);
    expect(g.nodes.find((n) => n.kind === 'session')?.archived).toBe(true);
  });

  it('binds cards to contexts and to sessions carrying their marker', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: {}, cardId: 'card-1', consumed: 0 }]]),
      contexts: [ctx('a')],
      cards: [card('card-1', { contextIds: ['a', 'missing'] })],
    });
    expect(g.edges).toEqual([
      { source: 'k:card-1', target: 'c:a', kind: 'card' },
      { source: 'k:card-1', target: `s:${S1}`, kind: 'card' },
    ]);
  });

  it('drops duplicate and self edges', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: { a: 'write' }, consumed: 0 }]]),
      contexts: [ctx('a', { origin: S1, links: ['a'] })],
      cards: [],
    });
    expect(g.edges).toHaveLength(1);
  });

  it('wires a topic edge from the loose repo/skill/mcp signal, weighted', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: {}, topics: { dirs: { cockpit: 5 }, skills: {}, mcp: {} }, consumed: 0 }]]),
      contexts: [ctx('hub_deck'), ctx('cockpit_ping_regression')],
      cards: [],
    });
    const topic = g.edges.filter((e) => e.kind === 'topic');
    expect(topic.map((e) => e.target).sort()).toEqual(['c:cockpit_ping_regression', 'c:hub_deck']);
    expect(topic.every((e) => (e.weight ?? 0) > 0 && (e.weight ?? 0) <= 1)).toBe(true);
  });

  it('does not add a topic edge on top of an existing read/write edge to the same context', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: { cockpit_ping_regression: 'write' }, topics: { dirs: { cockpit: 5 }, skills: {}, mcp: {} }, consumed: 0 }]]),
      contexts: [ctx('cockpit_ping_regression')],
      cards: [],
    });
    expect(g.edges).toEqual([{ source: `s:${S1}`, target: 'c:cockpit_ping_regression', kind: 'write' }]);
  });
});
