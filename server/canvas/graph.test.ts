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

  it('weights a read/write edge by contextHits, capped like a topic edge, and leaves it unweighted when hits are absent (older cache entry)', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: { deck_todo: 'write', hub_dfl: 'read' }, contextHits: { deck_todo: 3 }, consumed: 0 }]]),
      contexts: [ctx('deck_todo'), ctx('hub_dfl')],
      cards: [],
    });
    expect(g.edges).toContainEqual({ source: `s:${S1}`, target: 'c:deck_todo', kind: 'write', weight: 0.6 });
    expect(g.edges).toContainEqual({ source: `s:${S1}`, target: 'c:hub_dfl', kind: 'read' }); // no hits recorded: unweighted, same as before
  });

  it('wires a session node to its fork parent when both are present in the graph', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }, { meta: meta(S2), archived: false }],
      refs: new Map(), contexts: [], cards: [],
      forkParents: new Map([[S2, S1]]),
    });
    expect(g.nodes.find((n) => n.ref === S2)?.parentSessionId).toBe(S1);
    expect(g.nodes.find((n) => n.ref === S1)?.parentSessionId).toBeUndefined();
  });

  it('drops a fork-parent pointer to a session not in this graph, rather than dangling', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S2), archived: false }],
      refs: new Map(), contexts: [], cards: [],
      forkParents: new Map([[S2, S1]]), // S1 never listed
    });
    expect(g.nodes.find((n) => n.ref === S2)?.parentSessionId).toBeUndefined();
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

  it('gives a prompt-input session its own "input" kind, distinct from a marker-bound agent session', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }, { meta: meta(S2), archived: false }],
      refs: new Map(),
      contexts: [],
      cards: [card('card-1', { sessionIds: [S1, S2] })],
    });
    expect(g.edges).toEqual([
      { source: 'k:card-1', target: `s:${S1}`, kind: 'input' },
      { source: 'k:card-1', target: `s:${S2}`, kind: 'input' },
    ]);
  });

  it('keeps a session "card" (marker-bound) even when it is also picked as prompt input', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: {}, cardId: 'card-1', consumed: 0 }]]),
      contexts: [],
      cards: [card('card-1', { sessionIds: [S1] })],
    });
    expect(g.edges).toEqual([{ source: 'k:card-1', target: `s:${S1}`, kind: 'card' }]);
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

  it('wires a topic edge from the loose repo/skill/mcp signal: hub vote + exact-leaf, weighted', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: {}, topics: { dirs: { cockpit: 5 }, skills: {}, mcp: {} }, consumed: 0 }]]),
      contexts: [ctx('hub_deck', { links: ['cockpit_ping_regression'] }), ctx('cockpit_ping_regression')],
      cards: [],
    });
    const topic = g.edges.filter((e) => e.kind === 'topic');
    expect(topic.map((e) => e.target).sort()).toEqual(['c:cockpit_ping_regression', 'c:hub_deck']);
    expect(topic.every((e) => (e.weight ?? 0) > 0 && (e.weight ?? 0) <= 1)).toBe(true);
  });

  it('votes a hub without a hub-linked leaf, but never a leaf edge for a generic family token (mcp)', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: {}, topics: { dirs: {}, skills: {}, mcp: { 'dfl-work': 6 } }, consumed: 0 }]]),
      contexts: [ctx('hub_dfl', { links: ['dfl_edge_functions'] }), ctx('dfl_edge_functions')],
      cards: [],
    });
    const topic = g.edges.filter((e) => e.kind === 'topic');
    expect(topic.map((e) => e.target)).toEqual(['c:hub_dfl']); // no c:dfl_edge_functions leaf edge from an mcp signal
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

  it('carries merged activity intervals onto the session node', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: {}, activity: [[10, 20]], consumed: 0 }]]),
      contexts: [],
      cards: [],
      now: 1000, // within the 7d trim window of the [10, 20] interval
    });
    expect(g.nodes.find((n) => n.id === `s:${S1}`)?.activity).toEqual([[10, 20]]);
  });

  it('adds a conflict edge when two sessions with overlapping activity wrote the same file, one running', () => {
    const path = '/home/u/repo/src/App.tsx';
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }, { meta: meta(S2), archived: false }],
      refs: new Map([
        [S1, { contexts: {}, writes: { [path]: 1000 }, activity: [[0, 2_000_000]], consumed: 0 }],
        [S2, { contexts: {}, writes: { [path]: 1000 + 60_000 }, activity: [[0, 2_000_000]], consumed: 0 }],
      ]),
      contexts: [],
      cards: [],
      running: new Set([S1]),
      now: 2_000_000,
    });
    const conflict = g.edges.find((e) => e.kind === 'conflict');
    expect(conflict).toMatchObject({ source: `s:${S1}`, target: `s:${S2}`, files: [path] });
  });

  it('does not add a conflict edge when neither session is active (running/waiting/recent)', () => {
    const path = '/home/u/repo/src/App.tsx';
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }, { meta: meta(S2), archived: false }],
      refs: new Map([
        [S1, { contexts: {}, writes: { [path]: 0 }, activity: [[0, 2000]], consumed: 0 }],
        [S2, { contexts: {}, writes: { [path]: 1000 }, activity: [[0, 2000]], consumed: 0 }],
      ]),
      contexts: [],
      cards: [],
      now: 100 * 3600_000, // well past the 48h "recent" window from mtime 0
    });
    expect(g.edges.some((e) => e.kind === 'conflict')).toBe(false);
  });

  it('does not add a conflict edge for a write under memoryDir (noisy path wired through)', () => {
    const path = '/home/u/.claude/projects/x/memory/hub_deck.md';
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }, { meta: meta(S2), archived: false }],
      refs: new Map([
        [S1, { contexts: {}, writes: { [path]: 0 }, activity: [[0, 2000]], consumed: 0 }],
        [S2, { contexts: {}, writes: { [path]: 1000 }, activity: [[0, 2000]], consumed: 0 }],
      ]),
      contexts: [],
      cards: [],
      running: new Set([S1]),
      now: 2_000_000,
      memoryDir: '/home/u/.claude/projects/x/memory',
    });
    expect(g.edges.some((e) => e.kind === 'conflict')).toBe(false);
  });

  it('trims a session\'s activity payload to intervals ending within the last 7 days', () => {
    const sevenDays = 7 * 24 * 3600_000;
    const now = 10 * sevenDays;
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: false }],
      refs: new Map([[S1, { contexts: {}, activity: [[0, 100], [now - 1000, now - 500]], consumed: 0 }]]),
      contexts: [],
      cards: [],
      now,
    });
    expect(g.nodes.find((n) => n.id === `s:${S1}`)?.activity).toEqual([[now - 1000, now - 500]]);
  });

  it('never sends activity for an archived session', () => {
    const g = buildCanvasGraph({
      sessions: [{ meta: meta(S1), archived: true }],
      refs: new Map([[S1, { contexts: {}, activity: [[10, 20]], consumed: 0 }]]),
      contexts: [],
      cards: [],
    });
    expect(g.nodes.find((n) => n.id === `s:${S1}`)?.activity).toBeUndefined();
  });
});
