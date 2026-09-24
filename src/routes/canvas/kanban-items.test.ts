import { describe, expect, it } from 'vitest';
import type { CanvasCard, CanvasEdge, CanvasNode } from '../../../shared/canvas';
import {
  deriveSessionItems, deriveSessionStatus, doneRecentSessionIds, isOverrideActive, orchestratorKanbanItem, resolvePendingBoundIds,
} from './kanban-items';

describe('isOverrideActive', () => {
  it('is false with no override', () => {
    expect(isOverrideActive(undefined, 100, undefined)).toBe(false);
  });

  it('holds while nothing moved since it was set', () => {
    expect(isOverrideActive({ status: 'done', at: 100 }, 50, undefined)).toBe(true);
  });

  it('expires once the session mtime passes the override', () => {
    expect(isOverrideActive({ status: 'done', at: 100 }, 150, undefined)).toBe(false);
  });

  it('expires once a new turn starts, even before mtime catches up', () => {
    expect(isOverrideActive({ status: 'done', at: 100 }, 100, 120)).toBe(false);
  });
});

describe('deriveSessionStatus', () => {
  const base = { mtime: 0, running: false, waiting: false, everRan: true };

  it('running always reads as In progress, override or not', () => {
    expect(deriveSessionStatus({ ...base, running: true, override: { status: 'done', at: 999 } })).toBe('doing');
  });

  it('waiting on the user reads as In progress', () => {
    expect(deriveSessionStatus({ ...base, waiting: true })).toBe('doing');
  });

  it('a session that never ran a turn is ToDo', () => {
    expect(deriveSessionStatus({ ...base, everRan: false })).toBe('todo');
  });

  it('idle after a clean close reads as Done with no override', () => {
    expect(deriveSessionStatus(base)).toBe('review');
  });

  it('an active override wins over the automatic Done reading', () => {
    expect(deriveSessionStatus({ ...base, mtime: 50, override: { status: 'done', at: 100 } })).toBe('done');
  });

  it('a new turn after the override falls back to the automatic reading', () => {
    expect(deriveSessionStatus({ ...base, mtime: 200, override: { status: 'done', at: 100 } })).toBe('review');
  });

  it('a crashed/stopped/failed last turn reads as In progress, not Done', () => {
    expect(deriveSessionStatus({ ...base, attentionNeeded: true })).toBe('doing');
  });

  it('running/waiting still win over attentionNeeded', () => {
    expect(deriveSessionStatus({ ...base, attentionNeeded: true, running: true })).toBe('doing');
    expect(deriveSessionStatus({ ...base, attentionNeeded: true, waiting: true })).toBe('doing');
  });

  it('an active override wins over attentionNeeded too (the user already looked)', () => {
    expect(deriveSessionStatus({ ...base, mtime: 50, attentionNeeded: true, override: { status: 'done', at: 100 } })).toBe('done');
  });
});

describe('deriveSessionItems', () => {
  const session = (id: string, extra: Partial<CanvasNode> = {}): CanvasNode => ({
    id: `s:${id}`, kind: 'session', ref: id, title: `sessão ${id}`, subtitle: 'trabalho real', mtime: 10, count: 3, ...extra,
  });
  const card = (id: string): CanvasCard => ({
    id, title: 'card', prompt: 'p', status: 'doing', kind: 'task', contextIds: [], sessionIds: [], createdAt: 0, updatedAt: 0,
  });

  it('turns a plain session into a kanban item', () => {
    const items = deriveSessionItems({
      nodes: [session('a')], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sessionId: 'a', status: 'review' });
  });

  it('excludes a session already bound to a card (the card represents it)', () => {
    const edges: CanvasEdge[] = [{ source: 'k:c1', target: 's:a', kind: 'card' }];
    const items = deriveSessionItems({
      nodes: [session('a')], edges, cards: [card('c1')], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false,
    });
    expect(items).toHaveLength(0);
  });

  it('an "input"-kind edge does NOT count as bound (the card never ran on it)', () => {
    const edges: CanvasEdge[] = [{ source: 'k:c1', target: 's:a', kind: 'input' }];
    const items = deriveSessionItems({
      nodes: [session('a')], edges, cards: [card('c1')], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false,
    });
    expect(items).toHaveLength(1);
  });

  it('drops automation noise by default and keeps it when asked', () => {
    const nodes = [session('ping', { title: '.', subtitle: '' })];
    const hidden = deriveSessionItems({ nodes, edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false });
    const shown = deriveSessionItems({ nodes, edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: true });
    expect(hidden).toHaveLength(0);
    expect(shown).toHaveLength(1);
  });

  it('flags waitingOnUser independently of status', () => {
    const items = deriveSessionItems({
      nodes: [session('a', { waiting: true })], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false,
    });
    expect(items[0]).toMatchObject({ status: 'doing', waitingOnUser: true });
  });

  it('excludes a session bound only via extraBoundIds (pendingLaunch/flowRuns, edge not synced yet)', () => {
    const items = deriveSessionItems({
      nodes: [session('a')], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {},
      showAutomation: false, extraBoundIds: ['a'],
    });
    expect(items).toHaveLength(0);
  });

  it('server lastTurnOk=false flags needsAttention and keeps status In progress', () => {
    const items = deriveSessionItems({
      nodes: [session('a')], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false,
      liveSessions: new Map([['a', { mtime: 10, lastTurnOk: false }]]),
    });
    expect(items[0]).toMatchObject({ status: 'doing', needsAttention: true });
  });

  it('lastTurnOk=true (or unknown) never sets needsAttention', () => {
    const ok = deriveSessionItems({
      nodes: [session('a')], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false,
      liveSessions: new Map([['a', { mtime: 10, lastTurnOk: true }]]),
    });
    expect(ok[0]).toMatchObject({ status: 'review', needsAttention: false });
    const unknown = deriveSessionItems({
      nodes: [session('a')], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false,
    });
    expect(unknown[0]).toMatchObject({ status: 'review', needsAttention: false });
  });

  it('the client interrupted map flags needsAttention even before the server outcome syncs', () => {
    const items = deriveSessionItems({
      nodes: [session('a')], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {}, showAutomation: false,
      interrupted: { a: 'error_max_budget' },
    });
    expect(items[0]).toMatchObject({ status: 'doing', needsAttention: true });
  });

  it('an active Completed override suppresses the needsAttention badge', () => {
    const items = deriveSessionItems({
      nodes: [session('a', { mtime: 5 })], edges: [], cards: [], running: new Set(),
      overrides: { a: { status: 'done', at: 10 } }, turnStartedAt: {}, showAutomation: false,
      liveSessions: new Map([['a', { mtime: 5, lastTurnOk: false }]]),
    });
    expect(items[0]).toMatchObject({ status: 'done', needsAttention: false });
  });

  it('prefers liveSessions (p.sessions) over the possibly-stale node for waiting/mtime', () => {
    const items = deriveSessionItems({
      nodes: [session('a', { waiting: false, mtime: 5 })], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {},
      showAutomation: false, liveSessions: new Map([['a', { waiting: true, mtime: 999 }]]),
    });
    expect(items[0]).toMatchObject({ status: 'doing', waitingOnUser: true, mtime: 999 });
  });

  it('excludes the orchestrator session — it never shows as a normal item', () => {
    const items = deriveSessionItems({
      nodes: [session('a'), session('b')], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {},
      showAutomation: false, orchestratorSessionId: 'a',
    });
    expect(items).toHaveLength(1);
    expect(items[0].sessionId).toBe('b');
  });
});

describe('orchestratorKanbanItem', () => {
  const session = (id: string, extra: Partial<CanvasNode> = {}): CanvasNode => ({
    id: `s:${id}`, kind: 'session', ref: id, title: `sessão ${id}`, subtitle: '', mtime: 10, count: 3, ...extra,
  });
  const opts = { running: new Set<string>(), overrides: {}, turnStartedAt: {} };

  it('is undefined with no orchestrator configured', () => {
    expect(orchestratorKanbanItem([session('a')], opts, undefined)).toBeUndefined();
  });

  it('is undefined when the orchestrator session has no node yet', () => {
    expect(orchestratorKanbanItem([session('a')], opts, 'missing')).toBeUndefined();
  });

  it('finds the item unconditionally — no automation/bound filtering', () => {
    const item = orchestratorKanbanItem([session('a')], opts, 'a');
    expect(item).toMatchObject({ sessionId: 'a', nodeId: 's:a' });
  });
});

describe('resolvePendingBoundIds', () => {
  it('keeps the pending run key even with no migration yet', () => {
    const ids = resolvePendingBoundIds(['new-abc'], {});
    expect(ids).toEqual(new Set(['new-abc']));
  });

  it('adds the migrated real session id alongside the local key', () => {
    const ids = resolvePendingBoundIds(['new-abc'], { 'new-abc': 'real-session-id' });
    expect(ids).toEqual(new Set(['new-abc', 'real-session-id']));
  });

  it('a #592 flow run key resolves the same way as a client-launched one', () => {
    const ids = resolvePendingBoundIds(['new-flow-1'], { 'new-flow-1': 'session-xyz' });
    expect(ids.has('session-xyz')).toBe(true);
  });

  it('leaves an already-real key (continue reuse) untouched', () => {
    const ids = resolvePendingBoundIds(['already-real-id'], {});
    expect(ids).toEqual(new Set(['already-real-id']));
  });

  it('handles multiple pending keys independently', () => {
    const ids = resolvePendingBoundIds(['new-a', 'new-b'], { 'new-a': 'real-a' });
    expect(ids).toEqual(new Set(['new-a', 'real-a', 'new-b']));
  });
});

describe('deriveSessionItems with a migrated pending session', () => {
  const session = (id: string, extra: Partial<CanvasNode> = {}): CanvasNode => ({
    id: `s:${id}`, kind: 'session', ref: id, title: `sessão ${id}`, subtitle: '', mtime: 10, count: 3, ...extra,
  });

  it('excludes the session once its `new-` run key has migrated to the real id (no graph edge yet)', () => {
    const extraBoundIds = resolvePendingBoundIds(['new-abc'], { 'new-abc': 'real-session-id' });
    const items = deriveSessionItems({
      nodes: [session('real-session-id')], edges: [], cards: [], running: new Set(), overrides: {}, turnStartedAt: {},
      showAutomation: false, extraBoundIds,
    });
    expect(items).toHaveLength(0);
  });
});

describe('doneRecentSessionIds', () => {
  const session = (id: string, extra: Partial<CanvasNode> = {}): CanvasNode => ({
    id: `s:${id}`, kind: 'session', ref: id, title: `sessão ${id}`, subtitle: '', mtime: 10, count: 3, ...extra,
  });
  const opts = { running: new Set<string>(), overrides: {}, turnStartedAt: {} };

  it('keeps a Done item inside the 24h window and drops an older one', () => {
    const now = 100 * 3600_000;
    const nodes = [
      session('fresh', { mtime: now - 3600_000 }),
      session('old', { mtime: now - 30 * 3600_000 }),
    ];
    const ids = doneRecentSessionIds(nodes, opts, now);
    expect(ids.has('s:fresh')).toBe(true);
    expect(ids.has('s:old')).toBe(false);
  });

  it('a running session (not Done) never counts, regardless of mtime', () => {
    const now = 100 * 3600_000;
    const nodes = [session('doing', { mtime: now })];
    const ids = doneRecentSessionIds(nodes, { ...opts, running: new Set(['doing']) }, now);
    expect(ids.has('s:doing')).toBe(false);
  });

  it('runs over EVERY session node — a card-bound session still counts (item 1: not just unbound ones)', () => {
    // doneRecentSessionIds takes raw nodes, not deriveSessionItems' deduped
    // output — a session bound to a card was never meant to disappear from
    // "just finished" framing just because the card also represents it.
    const now = 100 * 3600_000;
    const nodes = [session('bound-to-card', { mtime: now - 3600_000 })];
    const ids = doneRecentSessionIds(nodes, opts, now);
    expect(ids.has('s:bound-to-card')).toBe(true);
  });
});
