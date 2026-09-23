// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CanvasCard, CanvasEdge } from '../../../shared/canvas';
import { useCardTerminalAutoOpen } from './useCardTerminalAutoOpen';

beforeEach(() => localStorage.clear());

const card = (over: Partial<CanvasCard> = {}): CanvasCard => ({
  id: 'card-1', title: 't', prompt: 'p', status: 'doing', kind: 'task',
  contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 1, ...over,
});
const boundEdge = (cardId: string, sessionId: string): CanvasEdge => ({ source: `k:${cardId}`, target: `s:${sessionId}`, kind: 'card' });

describe('useCardTerminalAutoOpen', () => {
  it('first load ever (no localStorage key) seeds the baseline WITHOUT opening anything', () => {
    const autoOpen = vi.fn();
    renderHook(() => useCardTerminalAutoOpen([card()], [boundEdge('card-1', 'sess-1')], {}, {}, vi.fn(), autoOpen, true));
    expect(autoOpen).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('cockpit:canvas.seenCardSessions')!)).toContain('card-1:sess-1');
  });

  it('a binding that appears AFTER the baseline was seeded IS opened', () => {
    const autoOpen = vi.fn();
    const props = { edges: [boundEdge('card-1', 'sess-1')] as CanvasEdge[] };
    const { rerender } = renderHook(
      ({ edges }) => useCardTerminalAutoOpen([card()], edges, {}, {}, vi.fn(), autoOpen, true),
      { initialProps: props },
    );
    expect(autoOpen).not.toHaveBeenCalled(); // baseline seed, first render

    rerender({ edges: [boundEdge('card-1', 'sess-1'), boundEdge('card-1', 'sess-2')] });
    expect(autoOpen).toHaveBeenCalledWith(['s:sess-2']);
    expect(autoOpen).not.toHaveBeenCalledWith(['s:sess-1']); // already-seeded pair never reopens
  });

  it('does not touch onCanvasPos when a saved window position already exists', () => {
    const onCanvasPos = vi.fn();
    const autoOpen = vi.fn();
    const props = { edges: [] as CanvasEdge[] };
    const { rerender } = renderHook(
      ({ edges }) => useCardTerminalAutoOpen([card()], edges, { 'k:card-1': { x: 10, y: 20 } }, { 'w:sess-1': { x: 5, y: 5 } }, onCanvasPos, autoOpen, true),
      { initialProps: props },
    );
    rerender({ edges: [boundEdge('card-1', 'sess-1')] });
    expect(autoOpen).toHaveBeenCalledWith(['s:sess-1']);
    expect(onCanvasPos).not.toHaveBeenCalled(); // 'w:sess-1' already has a saved spot
  });

  it('positions a fresh window near the card when no saved position exists', () => {
    const onCanvasPos = vi.fn();
    const autoOpen = vi.fn();
    const props = { edges: [] as CanvasEdge[] };
    const { rerender } = renderHook(
      ({ edges }) => useCardTerminalAutoOpen([card()], edges, { 'k:card-1': { x: 10, y: 20 } }, {}, onCanvasPos, autoOpen, true),
      { initialProps: props },
    );
    rerender({ edges: [boundEdge('card-1', 'sess-1')] });
    expect(onCanvasPos).toHaveBeenCalledWith({ 'w:sess-1': { x: 10, y: 20 - 400 - 40 } });
  });

  it('ignores cards that are not doing', () => {
    const autoOpen = vi.fn();
    renderHook(() => useCardTerminalAutoOpen([card({ status: 'review' })], [boundEdge('card-1', 'sess-1')], {}, {}, vi.fn(), autoOpen, true));
    expect(autoOpen).not.toHaveBeenCalled();
    // Baseline seed still writes (even empty — nothing WAS bound to a doing
    // card), establishing "already initialized" for the next real render.
    expect(JSON.parse(localStorage.getItem('cockpit:canvas.seenCardSessions')!)).toEqual([]);
  });

  // canvas review #593 third pass item 1: canvas-graph (the only source of
  // real marker-bound edges) answers well after canvas-board on first load —
  // `edges` is empty the whole time the graph hasn't arrived. Seeding the
  // baseline off THAT empty render, then treating the graph's real historical
  // bindings as "new" the moment it lands, would flood-open every doing
  // card's retry history at once. Nothing may run — not even the baseline
  // seed — before the caller reports the graph has actually loaded.
  it('does nothing at all while the graph has not loaded yet, even with cards/board data already present', () => {
    const autoOpen = vi.fn();
    renderHook(() => useCardTerminalAutoOpen([card()], [], {}, {}, vi.fn(), autoOpen, false));
    expect(autoOpen).not.toHaveBeenCalled();
    expect(localStorage.getItem('cockpit:canvas.seenCardSessions')).toBeNull(); // no baseline seeded yet either
  });

  it('mount before the graph loads, then the graph arrives with historical bindings already in it: seeds the baseline, does NOT flood-open them', () => {
    const autoOpen = vi.fn();
    const props = { edges: [] as CanvasEdge[], graphReady: false };
    const { rerender } = renderHook(
      ({ edges, graphReady }) => useCardTerminalAutoOpen([card()], edges, {}, {}, vi.fn(), autoOpen, graphReady),
      { initialProps: props },
    );
    expect(autoOpen).not.toHaveBeenCalled();

    // The graph frame lands: three sessions were already bound to this doing
    // card's retries LONG before this mount (a real transcript rescan, not
    // "new" activity) — this is the FIRST time graphReady is true, so it's
    // the baseline, not something to open.
    rerender({
      edges: [boundEdge('card-1', 'sess-1'), boundEdge('card-1', 'sess-2'), boundEdge('card-1', 'sess-3')],
      graphReady: true,
    });
    expect(autoOpen).not.toHaveBeenCalled();
    const seen = JSON.parse(localStorage.getItem('cockpit:canvas.seenCardSessions')!);
    expect(seen).toEqual(expect.arrayContaining(['card-1:sess-1', 'card-1:sess-2', 'card-1:sess-3']));

    // A GENUINELY new binding after that point still opens normally.
    rerender({
      edges: [boundEdge('card-1', 'sess-1'), boundEdge('card-1', 'sess-2'), boundEdge('card-1', 'sess-3'), boundEdge('card-1', 'sess-4')],
      graphReady: true,
    });
    expect(autoOpen).toHaveBeenCalledWith(['s:sess-4']);
  });
});
