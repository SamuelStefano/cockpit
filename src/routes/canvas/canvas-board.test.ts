import { describe, it, expect } from 'vitest';
import { CARD_ID_RE, type CanvasCard, type CanvasGraph } from '../../../shared/canvas';
import { boundSessions, capRecent, cardRun, mergeBoard, newCardId, newlyBoundSessions, resolveSaveStatus, stuckContinueCard } from './canvas-board';

const card = (extra: Partial<CanvasCard> = {}): CanvasCard => ({
  id: 'card-1', title: 'T', prompt: 'P', status: 'todo', kind: 'task', contextIds: ['a'], sessionIds: [], createdAt: 1, updatedAt: 2, ...extra,
});
const graph: CanvasGraph = {
  builtAt: 1,
  nodes: [
    { id: 'c:a', kind: 'context', ref: 'a', title: 'a', subtitle: '', mtime: 1 },
    { id: 's:x', kind: 'session', ref: 'x', title: 'x', subtitle: '', mtime: 1 },
    { id: 'k:gone', kind: 'card', ref: 'gone', title: 'old', subtitle: '', mtime: 1 },
  ],
  edges: [
    { source: 'k:card-1', target: 's:x', kind: 'card' },
    { source: 'k:card-1', target: 'c:stale', kind: 'card' },
    { source: 'k:gone', target: 's:x', kind: 'card' },
  ],
};

describe('mergeBoard', () => {
  it('takes cards from the board and keeps only marker-bound session edges from the graph', () => {
    const r = mergeBoard(graph, [card({ title: 'fresh' })]);
    expect(r.nodes.filter((n) => n.kind === 'card').map((n) => n.title)).toEqual(['fresh']);
    expect(r.edges).toEqual([
      { source: 'k:card-1', target: 's:x', kind: 'card' },
      { source: 'k:card-1', target: 'c:a', kind: 'card' },
    ]);
  });

  it('works before the first graph frame', () => {
    expect(mergeBoard(null, [card()]).nodes).toHaveLength(1);
  });

  it('gives a prompt-input session its own "input" kind, not "card"', () => {
    const r = mergeBoard(graph, [card({ id: 'card-2', sessionIds: ['x'], contextIds: [] })]);
    expect(r.edges).toContainEqual({ source: 'k:card-2', target: 's:x', kind: 'input' });
  });

  it('does not downgrade an already marker-bound session to "input"', () => {
    const r = mergeBoard(graph, [card({ sessionIds: ['x'], contextIds: [] })]);
    expect(r.edges).toContainEqual({ source: 'k:card-1', target: 's:x', kind: 'card' });
    expect(r.edges).not.toContainEqual({ source: 'k:card-1', target: 's:x', kind: 'input' });
  });
});

describe('cardRun', () => {
  const edges = mergeBoard(graph, [card()]).edges;
  it('reads bound sessions', () => {
    expect(boundSessions(edges, 'card-1')).toEqual(['x']);
  });
  it('ignores prompt-input sessions, only marker-bound ones', () => {
    const withInput = mergeBoard(graph, [card({ id: 'card-2', sessionIds: ['x'], contextIds: [] })]).edges;
    expect(boundSessions(withInput, 'card-2')).toEqual([]);
  });
  it('running beats review, review needs doing + sessions', () => {
    expect(cardRun(card({ status: 'doing' }), ['x'], new Set(['x']))).toBe('running');
    expect(cardRun(card({ status: 'doing' }), ['x'], new Set())).toBe('review');
    expect(cardRun(card({ status: 'todo' }), ['x'], new Set())).toBe('idle');
    expect(cardRun(card({ status: 'doing' }), [], new Set())).toBe('idle');
  });
});

describe('resolveSaveStatus', () => {
  it('a brand-new card (no live/original) keeps the edited status', () => {
    expect(resolveSaveStatus(card({ status: 'todo' }), undefined, undefined)).toBe('todo');
  });

  it('the user explicitly changing status in the editor wins, even over a concurrent server move', () => {
    const original = card({ status: 'doing' });
    const edited = card({ status: 'done' }); // user dragged the status chip
    const live = card({ status: 'review' }); // server auto-moved it meanwhile
    expect(resolveSaveStatus(edited, original, live)).toBe('done');
  });

  it('an untouched status defers to the live (server-current) status', () => {
    const original = card({ status: 'doing' });
    const edited = card({ status: 'doing' }); // user never touched the status chip
    const live = card({ status: 'review' }); // card-review.ts moved it while the editor was open
    expect(resolveSaveStatus(edited, original, live)).toBe('review');
  });

  it('untouched status with no live card (deleted meanwhile) falls back to edited', () => {
    const original = card({ status: 'doing' });
    const edited = card({ status: 'doing' });
    expect(resolveSaveStatus(edited, original, undefined)).toBe('doing');
  });
});

describe('newlyBoundSessions', () => {
  const edges = mergeBoard(graph, [card({ status: 'doing' })]).edges;

  it('reports a bound session on a doing card not yet in `seen`, and marks it seen', () => {
    const seen = new Set<string>();
    const out = newlyBoundSessions([card({ status: 'doing' })], edges, seen);
    expect(out).toEqual([{ cardId: 'card-1', sessionId: 'x' }]);
    expect(seen.has('card-1:x')).toBe(true);
  });

  it('a pair already in `seen` (the mount-time baseline) is not reported again', () => {
    const seen = new Set(['card-1:x']);
    expect(newlyBoundSessions([card({ status: 'doing' })], edges, seen)).toEqual([]);
  });

  it('ignores cards that are not doing', () => {
    const seen = new Set<string>();
    expect(newlyBoundSessions([card({ status: 'todo' })], edges, seen)).toEqual([]);
    expect(newlyBoundSessions([card({ status: 'review' })], edges, seen)).toEqual([]);
  });

  it('calling twice in a row only reports the pair once (idempotent seeding)', () => {
    const seen = new Set<string>();
    const cards = [card({ status: 'doing' })];
    expect(newlyBoundSessions(cards, edges, seen)).toHaveLength(1);
    expect(newlyBoundSessions(cards, edges, seen)).toHaveLength(0);
  });
});

describe('newCardId', () => {
  it('matches the server id rule', () => {
    expect(CARD_ID_RE.test(newCardId(Date.now(), 0.5))).toBe(true);
    expect(CARD_ID_RE.test(newCardId(0, 0))).toBe(true);
  });
});

describe('stuckContinueCard', () => {
  const buildPrompt = (c: CanvasCard) => `PROMPT:${c.id}`;

  it('no error -> undefined', () => {
    expect(stuckContinueCard([card()], null, buildPrompt)).toBeUndefined();
  });

  it('matches a "doing" continue card by session AND prompt text, with a CURRENT-enough error', () => {
    const c = card({ status: 'doing', reuse: { mode: 'continue', sessionId: 'sess-1' }, updatedAt: 100 });
    const err = { sessionId: 'sess-1', text: 'PROMPT:card-1', at: 100 };
    expect(stuckContinueCard([c], err, buildPrompt)).toBe(c);
  });

  it('never matches a card not currently "doing" (already recovered, or a manual move)', () => {
    const c = card({ status: 'todo', reuse: { mode: 'continue', sessionId: 'sess-1' } });
    const err = { sessionId: 'sess-1', text: 'PROMPT:card-1', at: 100 };
    expect(stuckContinueCard([c], err, buildPrompt)).toBeUndefined();
  });

  it('never matches "fork" or "new" mode — those aren\'t sent via onSendTo', () => {
    const fork = card({ status: 'doing', reuse: { mode: 'fork', sessionId: 'sess-1' }, updatedAt: 100 });
    const err = { sessionId: 'sess-1', text: 'PROMPT:card-1', at: 100 };
    expect(stuckContinueCard([fork], err, buildPrompt)).toBeUndefined();
  });

  it('an unrelated rejection in the SAME session (different text) never false-matches', () => {
    const c = card({ status: 'doing', reuse: { mode: 'continue', sessionId: 'sess-1' }, updatedAt: 100 });
    const err = { sessionId: 'sess-1', text: 'algo digitado à mão na barra do canvas', at: 100 };
    expect(stuckContinueCard([c], err, buildPrompt)).toBeUndefined();
  });

  // Regression (review #597 follow-up point 1): an error the caller never
  // got to dismiss (no open terminal on that session) sits in state forever.
  // Without this guard, a LATER, genuinely successful re-run of the SAME
  // card+session+text (moveCard always stamps a fresh, later updatedAt on
  // every attempt) would still false-match the OLD rejection and bounce the
  // card back to ToDo right after it started succeeding.
  it('a STALE error (older than the card\'s current run) never matches', () => {
    const c = card({ status: 'doing', reuse: { mode: 'continue', sessionId: 'sess-1' }, updatedAt: 200 });
    const staleErr = { sessionId: 'sess-1', text: 'PROMPT:card-1', at: 100 }; // predates this run's updatedAt
    expect(stuckContinueCard([c], staleErr, buildPrompt)).toBeUndefined();
  });

  it('an error at EXACTLY the run\'s updatedAt still matches (>=, not >)', () => {
    const c = card({ status: 'doing', reuse: { mode: 'continue', sessionId: 'sess-1' }, updatedAt: 200 });
    const err = { sessionId: 'sess-1', text: 'PROMPT:card-1', at: 200 };
    expect(stuckContinueCard([c], err, buildPrompt)).toBe(c);
  });
});

describe('capRecent', () => {
  it('leaves a short list untouched', () => {
    expect(capRecent(['a', 'b'], 5)).toEqual(['a', 'b']);
  });

  it('keeps only the LAST (most recently appended) `max` ids', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`);
    expect(capRecent(ids, 3)).toEqual(['id-7', 'id-8', 'id-9']);
  });

  it('defaults to the 200 cap', () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    expect(capRecent(ids)).toHaveLength(200);
    expect(capRecent(ids)[0]).toBe('id-50');
  });
});
