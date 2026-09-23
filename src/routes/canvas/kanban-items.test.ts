import { describe, expect, it } from 'vitest';
import type { CanvasCard, CanvasEdge, CanvasNode } from '../../../shared/canvas';
import { deriveSessionItems, deriveSessionStatus, doneRecentSessionIds, isOverrideActive } from './kanban-items';

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
});

describe('doneRecentSessionIds', () => {
  it('keeps a Done item inside the 24h window and drops an older one', () => {
    const now = 100 * 3600_000;
    const items = [
      { nodeId: 's:fresh', sessionId: 'fresh', title: '', subtitle: '', status: 'review' as const, running: false, waitingOnUser: false, mtime: now - 3600_000 },
      { nodeId: 's:old', sessionId: 'old', title: '', subtitle: '', status: 'review' as const, running: false, waitingOnUser: false, mtime: now - 30 * 3600_000 },
      { nodeId: 's:doing', sessionId: 'doing', title: '', subtitle: '', status: 'doing' as const, running: true, waitingOnUser: false, mtime: now },
    ];
    const ids = doneRecentSessionIds(items, now);
    expect(ids.has('s:fresh')).toBe(true);
    expect(ids.has('s:old')).toBe(false);
    expect(ids.has('s:doing')).toBe(false);
  });
});
