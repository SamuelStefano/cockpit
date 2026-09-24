// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SessionKanbanItem } from './kanban-items';
import { useKanbanCtxPoll } from './useKanbanCtxPoll';

const NOW = 1_700_000_000_000;
const item = (over: Partial<SessionKanbanItem>): SessionKanbanItem => ({
  nodeId: `s:${over.sessionId ?? 'a'}`, sessionId: 'a', title: 't', subtitle: '', orchestratorChild: false,
  status: 'doing', running: false, waitingOnUser: false, needsAttention: false, mtime: NOW, ...over,
});

describe('useKanbanCtxPoll', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(NOW));
  afterEach(() => vi.useRealTimers());

  it('requests ctx for the visible items at mount, then every 15s', () => {
    const request = vi.fn();
    const items = [item({ sessionId: 'a' }), item({ sessionId: 'b' })];
    renderHook(() => useKanbanCtxPoll(items, true, request));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(['a', 'b']);
    vi.advanceTimersByTime(15_000);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('never fires while inactive (map mode, dock closed)', () => {
    const request = vi.fn();
    renderHook(() => useKanbanCtxPoll([item({})], false, request));
    vi.advanceTimersByTime(30_000);
    expect(request).not.toHaveBeenCalled();
  });

  it('drops a session past the 24h staleness window (triageSessionItems)', () => {
    const request = vi.fn();
    const stale = item({ sessionId: 'old', mtime: NOW - 25 * 3600_000, status: 'review' });
    const fresh = item({ sessionId: 'new' });
    renderHook(() => useKanbanCtxPoll([stale, fresh], true, request));
    expect(request).toHaveBeenCalledWith(['new']);
  });

  it('caps the request at 40 ids', () => {
    const request = vi.fn();
    const items = Array.from({ length: 50 }, (_, i) => item({ sessionId: `s${i}` }));
    renderHook(() => useKanbanCtxPoll(items, true, request));
    expect(request.mock.calls[0][0]).toHaveLength(40);
  });

  it('skips the request when nothing is visible, without erroring', () => {
    const request = vi.fn();
    renderHook(() => useKanbanCtxPoll([], true, request));
    expect(request).not.toHaveBeenCalled();
  });
});
