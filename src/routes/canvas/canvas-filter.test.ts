import { describe, it, expect } from 'vitest';
import type { CanvasCard, CanvasEdge, CanvasNode } from '../../../shared/canvas';
import { ACTIVE_WINDOW_MS, filterCanvas, neighbors } from './canvas-filter';

const NOW = 100 * ACTIVE_WINDOW_MS;
const n = (id: string, kind: CanvasNode['kind'], extra: Partial<CanvasNode> = {}): CanvasNode =>
  ({ id, kind, ref: id.slice(2), title: id, subtitle: '', mtime: NOW, ...extra });

const nodes = [
  n('c:hub_a', 'context', { hub: true }), n('c:leaf', 'context'), n('c:other', 'context'),
  n('s:fresh', 'session'), n('s:old', 'session', { mtime: 0 }), n('s:arch', 'session', { archived: true }),
  n('k:open', 'card'),
];
const edges: CanvasEdge[] = [
  { source: 'c:hub_a', target: 'c:leaf', kind: 'link' },
  { source: 's:fresh', target: 'c:leaf', kind: 'read' },
  { source: 's:old', target: 'c:other', kind: 'read' },
  { source: 's:arch', target: 'c:other', kind: 'write' },
];
const card = { id: 'open', status: 'todo' } as CanvasCard;
// showContexts: true keeps every test below about scope/seed logic, not about
// the toggle itself — see the dedicated 'showContexts' describe block.
const base = { scope: 'active' as const, archived: false, query: '', running: new Set<string>(), cards: [card], now: NOW, showContexts: true };
const ids = (r: { nodes: CanvasNode[] }) => r.nodes.map((x) => x.id).sort();

describe('filterCanvas', () => {
  it('active scope keeps recent sessions, their contexts, hubs above and open cards', () => {
    expect(ids(filterCanvas(nodes, edges, base))).toEqual(['c:hub_a', 'c:leaf', 'k:open', 's:fresh']);
  });

  it('a running old session counts as active', () => {
    expect(ids(filterCanvas(nodes, edges, { ...base, running: new Set(['old']) }))).toContain('s:old');
  });

  it('a waiting session counts as active even outside the window', () => {
    const waiting = [...nodes, n('s:waits', 'session', { mtime: 0, waiting: true })];
    expect(ids(filterCanvas(waiting, edges, base))).toContain('s:waits');
  });

  it('excludes a cron-ping session even when fresh', () => {
    const ping = [...nodes, n('s:ping', 'session', { title: '.', subtitle: '' })];
    expect(ids(filterCanvas(ping, edges, base))).not.toContain('s:ping');
  });

  it('excludes an empty (count 0) session even when fresh', () => {
    const empty = [...nodes, n('s:empty', 'session', { count: 0 })];
    expect(ids(filterCanvas(empty, edges, base))).not.toContain('s:empty');
  });

  it('all scope hides archived unless asked', () => {
    expect(ids(filterCanvas(nodes, edges, { ...base, scope: 'all' }))).not.toContain('s:arch');
    expect(ids(filterCanvas(nodes, edges, { ...base, scope: 'all', archived: true }))).toContain('s:arch');
  });

  it('query keeps matches plus their visible neighbors', () => {
    const r = filterCanvas(nodes, edges, { ...base, scope: 'all', query: 'leaf' });
    expect(ids(r)).toEqual(['c:hub_a', 'c:leaf', 's:fresh']);
    expect(r.edges).toHaveLength(2);
  });

  it('an area filter keeps only that area, on top of scope/query', () => {
    const areaNodes = nodes.map((x) => (x.id === 'c:hub_a' || x.id === 'c:leaf' ? { ...x, area: 'deck' as const } : x));
    const r = filterCanvas(areaNodes, edges, { ...base, scope: 'all', area: 'deck' });
    expect(ids(r)).toEqual(['c:hub_a', 'c:leaf']);
  });

  it('no area filter (undefined) keeps the previous behavior', () => {
    expect(ids(filterCanvas(nodes, edges, { ...base, scope: 'all', area: undefined }))).toEqual(ids(filterCanvas(nodes, edges, { ...base, scope: 'all' })));
  });
});

describe('filterCanvas — exec scope', () => {
  // `base.cards` carries a single 'todo' card ('k:open') with no edges of its
  // own — every exec-scope assertion below inherits it as a seed (see the
  // dedicated card tests further down), so most checks here use `toContain`/
  // `not.toContain` rather than a full `toEqual` to stay focused on the
  // session-seed behaviour under test.
  it('keeps only running/waiting/windowed/done-recent sessions and their read/write contexts — no hub, no untouched leaf', () => {
    const execNodes = [
      ...nodes,
      n('s:waits', 'session', { mtime: 0, waiting: true }),
    ];
    const execEdges: CanvasEdge[] = [...edges, { source: 's:waits', target: 'c:other', kind: 'read' }];
    const r = filterCanvas(execNodes, execEdges, {
      ...base, scope: 'exec', running: new Set(['old']), windowIds: new Set(['s:fresh']),
    });
    expect(ids(r)).toEqual(['c:leaf', 'c:other', 'k:open', 's:fresh', 's:old', 's:waits']);
  });

  it('a link/topic edge never pulls in a neighbour, only read/write', () => {
    const withTopic: CanvasEdge[] = [...edges, { source: 's:fresh', target: 'c:other', kind: 'topic', weight: 1 }];
    const r = filterCanvas(nodes, withTopic, { ...base, scope: 'exec', running: new Set(['fresh']) });
    expect(ids(r)).not.toContain('c:other');
  });

  it('hides automation noise by default, shows it with showAutomation', () => {
    const ping = [...nodes, n('s:ping', 'session', { title: '.', subtitle: '' })];
    const hidden = filterCanvas(ping, edges, { ...base, scope: 'exec', running: new Set(['ping']) });
    const shown = filterCanvas(ping, edges, { ...base, scope: 'exec', running: new Set(['ping']), showAutomation: true });
    expect(ids(hidden)).not.toContain('s:ping');
    expect(ids(shown)).toContain('s:ping');
  });

  it('a done-recent session (flagged by the caller) is kept even idle and old', () => {
    const r = filterCanvas(nodes, edges, { ...base, scope: 'exec', doneRecentIds: new Set(['s:old']) });
    expect(ids(r)).toContain('s:old');
  });

  it('an idle, non-windowed, non-done-recent session is dropped', () => {
    const r = filterCanvas(nodes, edges, { ...base, scope: 'exec', cards: [] });
    expect(ids(r)).toEqual([]);
  });

  it('prefers liveSessions.waiting over the (possibly stale) node — a session waiting per the live list is a seed', () => {
    const stale = [...nodes, n('s:stale-wait', 'session', { mtime: 0, waiting: false })];
    const r = filterCanvas(stale, edges, {
      ...base, scope: 'exec', cards: [], liveSessions: new Map([['stale-wait', { waiting: true, mtime: 0 }]]),
    });
    expect(ids(r)).toContain('s:stale-wait');
  });

  it('a node marked waiting but the live list says otherwise is NOT a seed on that basis', () => {
    const stale = [...nodes, n('s:stale-idle', 'session', { mtime: 0, waiting: true })];
    const r = filterCanvas(stale, edges, {
      ...base, scope: 'exec', cards: [], liveSessions: new Map([['stale-idle', { waiting: false, mtime: 0 }]]),
    });
    expect(ids(r)).not.toContain('s:stale-idle');
  });

  describe('cards', () => {
    const cardNodes = [
      n('k:todo', 'card', { status: 'todo' }), n('k:done', 'card', { status: 'done' }),
      n('s:bound', 'session', { mtime: 0 }), n('c:card-ctx', 'context'),
    ];
    const cardEdges: CanvasEdge[] = [
      { source: 'k:todo', target: 's:bound', kind: 'card' },
      { source: 'k:todo', target: 'c:card-ctx', kind: 'card' },
    ];
    // filterCanvas's `openCards` comes from the CanvasCard business objects
    // (o.cards), not from the graph node's own `.status` — both must agree
    // for a card to act as a seed, same as every other scope.
    const cardObjs = [
      { id: 'todo', status: 'todo' } as CanvasCard,
      { id: 'done', status: 'done' } as CanvasCard,
    ];

    it('a card not yet Completed is a seed, pulling in its bound session and linked context', () => {
      const r = filterCanvas(cardNodes, cardEdges, { ...base, scope: 'exec', cards: cardObjs });
      expect(ids(r)).toEqual(['c:card-ctx', 'k:todo', 's:bound']);
    });

    it('a Completed card is never a seed, nor is it pulled in by anything else', () => {
      const r = filterCanvas(cardNodes, cardEdges, { ...base, scope: 'exec', cards: cardObjs });
      expect(ids(r)).not.toContain('k:done');
    });
  });
});

// #598 map cleanup: context/hub nodes (and the giant floating hub label
// CanvasNodeCard draws at low zoom) clutter the "what's happening now" view.
// Default OFF in exec/active; the toggle brings them back; 'all' scope is the
// memory map itself, so it always shows them regardless of the flag.
describe('filterCanvas — showContexts', () => {
  it('active scope hides contexts by default (showContexts omitted)', () => {
    const r = filterCanvas(nodes, edges, { ...base, showContexts: undefined });
    expect(ids(r)).toEqual(['k:open', 's:fresh']);
  });

  it('active scope hides contexts when explicitly false', () => {
    const r = filterCanvas(nodes, edges, { ...base, showContexts: false });
    expect(ids(r)).toEqual(['k:open', 's:fresh']);
  });

  it('exec scope hides contexts by default too', () => {
    const r = filterCanvas(nodes, edges, { ...base, scope: 'exec', showContexts: undefined, running: new Set(['fresh']) });
    expect(ids(r)).not.toContain('c:leaf');
  });

  it('exec scope shows contexts once toggled on', () => {
    const r = filterCanvas(nodes, edges, { ...base, scope: 'exec', showContexts: true, running: new Set(['fresh']) });
    expect(ids(r)).toContain('c:leaf');
  });

  it('all scope always shows contexts, ignoring the flag', () => {
    const r = filterCanvas(nodes, edges, { ...base, scope: 'all', showContexts: false });
    expect(ids(r)).toContain('c:hub_a');
  });
});

describe('neighbors', () => {
  it('is undirected', () => {
    expect([...neighbors(edges, 'c:leaf')].sort()).toEqual(['c:hub_a', 's:fresh']);
  });
});
