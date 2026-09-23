// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCanvas } from './useCanvas';
import { subscribeToast } from '../components/primitives/toast-bus';
import type { ServerMsg } from '../../shared/protocol';

const send = vi.fn(() => true);

describe('useCanvas — canvas-flow-failed toast', () => {
  it('shows an error toast with the server message, and does not touch board state', () => {
    const { result } = renderHook(() => useCanvas(send));
    const toasts: { message: string; tone?: string }[] = [];
    const unsub = subscribeToast((item) => toasts.push(item));

    act(() => {
      result.current.onMsg({ t: 'canvas-flow-failed', flowId: 'f1', message: 'Fluxo falhou de verdade' } as ServerMsg);
    });

    expect(toasts).toEqual([expect.objectContaining({ message: 'Fluxo falhou de verdade', tone: 'error' })]);
    expect(result.current.canvasBoard.flows).toEqual([]); // no board mutation from a notification-only frame
    unsub();
  });

  it('onMsg reports the frame as handled', () => {
    const { result } = renderHook(() => useCanvas(send));
    const unsub = subscribeToast(() => {});
    let handled = false;
    act(() => {
      handled = result.current.onMsg({ t: 'canvas-flow-failed', flowId: 'f1', message: 'x' } as ServerMsg);
    });
    expect(handled).toBe(true);
    unsub();
  });
});

describe('useCanvas — canvas-board flowRuns (reconnect visibility)', () => {
  it('merges flowRuns into canvasFlowRuns, keyed by cardId', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({
        t: 'canvas-board',
        board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {} },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    expect(result.current.canvasFlowRuns.card1?.key).toBe('new-abc');
  });

  it('an empty flowRuns array leaves any existing entry alone (does not clear it)', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {} },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    act(() => {
      result.current.onMsg({ t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {} }, flowRuns: [] } as ServerMsg);
    });
    expect(result.current.canvasFlowRuns.card1?.key).toBe('new-abc');
  });

  it('a repeated identical run for the same card does not change the object identity (no needless re-render trigger)', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {} },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    const before = result.current.canvasFlowRuns;
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {} },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    expect(result.current.canvasFlowRuns).toBe(before);
  });
});

describe('useCanvas — onCanvasSessionStatus', () => {
  it('applies the override optimistically and sends the wire frame', () => {
    const localSend = vi.fn(() => true);
    const { result } = renderHook(() => useCanvas(localSend));
    act(() => { result.current.onCanvasSessionStatus('sid-1', 'done'); });
    expect(result.current.canvasBoard.sessionStatus['sid-1']?.status).toBe('done');
    expect(localSend).toHaveBeenCalledWith({ t: 'canvas-session-status', sessionId: 'sid-1', status: 'done' });
  });

  it('a stale canvas-board frame within the grace window does not clobber the optimistic override', () => {
    const localSend = vi.fn(() => true);
    const { result } = renderHook(() => useCanvas(localSend));
    act(() => { result.current.onCanvasSessionStatus('sid-1', 'done'); });
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {} }, flowRuns: [],
      } as ServerMsg);
    });
    expect(result.current.canvasBoard.sessionStatus['sid-1']?.status).toBe('done');
  });
});

// review #597 follow-up point 2: two independent pollers share canvasTermStats
// (useTermStatsPoll's window poll via 'canvas-term-stats', CardEditor's
// reuse-pool lookup via 'canvas-ctx-stats') — neither may wipe the other's
// contribution.
describe('useCanvas — canvasTermStats merge (not replace)', () => {
  it('canvas-term-stats MERGES into the map instead of replacing it', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({ t: 'canvas-term-stats', stats: { 'sess-a': { cpu: 40, rssMb: 100, procs: 2 } } } as ServerMsg);
    });
    act(() => {
      result.current.onMsg({ t: 'canvas-term-stats', stats: { 'sess-b': { cpu: 10, rssMb: 50, procs: 1 } } } as ServerMsg);
    });
    // sess-a must still be here — a second round for a DIFFERENT id must not wipe it.
    expect(result.current.canvasTermStats['sess-a']).toEqual({ cpu: 40, rssMb: 100, procs: 2 });
    expect(result.current.canvasTermStats['sess-b']).toEqual({ cpu: 10, rssMb: 50, procs: 1 });
  });

  it('canvas-ctx-stats patches contextTokens WITHOUT resetting an existing cpu/rss/procs reading to 0', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({ t: 'canvas-term-stats', stats: { 'sess-a': { cpu: 40, rssMb: 100, procs: 2 } } } as ServerMsg);
    });
    act(() => {
      result.current.onMsg({ t: 'canvas-ctx-stats', stats: { 'sess-a': { contextTokens: 5000 } } } as ServerMsg);
    });
    // The real cpu/rss/procs from the window poller must survive a ctx-only patch.
    expect(result.current.canvasTermStats['sess-a']).toEqual({ cpu: 40, rssMb: 100, procs: 2, contextTokens: 5000 });
  });

  it('canvas-ctx-stats for a session with NO prior entry defaults cpu/rss/procs to 0', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({ t: 'canvas-ctx-stats', stats: { 'sess-new': { contextTokens: 1000 } } } as ServerMsg);
    });
    expect(result.current.canvasTermStats['sess-new']).toEqual({ cpu: 0, rssMb: 0, procs: 0, contextTokens: 1000 });
  });

  it('a canvas-term-stats round for the window poller does not erase a ctx-only entry for a DIFFERENT id', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({ t: 'canvas-ctx-stats', stats: { 'sess-candidate': { contextTokens: 2000 } } } as ServerMsg);
    });
    act(() => {
      result.current.onMsg({ t: 'canvas-term-stats', stats: { 'sess-window': { cpu: 5, rssMb: 20, procs: 1 } } } as ServerMsg);
    });
    expect(result.current.canvasTermStats['sess-candidate']).toEqual({ cpu: 0, rssMb: 0, procs: 0, contextTokens: 2000 });
    expect(result.current.canvasTermStats['sess-window']).toEqual({ cpu: 5, rssMb: 20, procs: 1 });
  });
});
