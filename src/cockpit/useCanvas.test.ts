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
        board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    expect(result.current.canvasFlowRuns.card1?.key).toBe('new-abc');
  });

  it('an empty flowRuns array leaves any existing entry alone (does not clear it)', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    act(() => {
      result.current.onMsg({ t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] }, flowRuns: [] } as ServerMsg);
    });
    expect(result.current.canvasFlowRuns.card1?.key).toBe('new-abc');
  });

  it('a repeated identical run for the same card does not change the object identity (no needless re-render trigger)', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    const before = result.current.canvasFlowRuns;
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] },
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
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] }, flowRuns: [],
      } as ServerMsg);
    });
    expect(result.current.canvasBoard.sessionStatus['sid-1']?.status).toBe('done');
  });
});

describe('useCanvas — onCanvasSessionStatusBulk (canvas review item 2: "completar antigos (N)")', () => {
  it('applies the SAME status to every id optimistically and sends one wire frame', () => {
    const localSend = vi.fn(() => true);
    const { result } = renderHook(() => useCanvas(localSend));
    act(() => { result.current.onCanvasSessionStatusBulk(['a', 'b', 'c'], 'done'); });
    expect(result.current.canvasBoard.sessionStatus.a?.status).toBe('done');
    expect(result.current.canvasBoard.sessionStatus.b?.status).toBe('done');
    expect(result.current.canvasBoard.sessionStatus.c?.status).toBe('done');
    expect(localSend).toHaveBeenCalledTimes(1);
    expect(localSend).toHaveBeenCalledWith({ t: 'canvas-session-status-bulk', sessionIds: ['a', 'b', 'c'], status: 'done' });
  });

  it('is a no-op on an empty selection', () => {
    const localSend = vi.fn(() => true);
    const { result } = renderHook(() => useCanvas(localSend));
    act(() => { result.current.onCanvasSessionStatusBulk([], 'done'); });
    expect(localSend).not.toHaveBeenCalled();
  });
});

describe('useCanvas — canvas-session-status / -bulk broadcast from another tab (item 12a)', () => {
  it('a slim canvas-session-status patch is applied to the board', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({ t: 'canvas-session-status', sessionId: 'sid-1', status: 'done', at: 5 } as ServerMsg);
    });
    expect(result.current.canvasBoard.sessionStatus['sid-1']).toEqual({ status: 'done', at: 5 });
  });

  it('a local write still inside its grace window is not clobbered by the broadcast for the SAME id', () => {
    const localSend = vi.fn(() => true);
    const { result } = renderHook(() => useCanvas(localSend));
    act(() => { result.current.onCanvasSessionStatus('sid-1', 'done'); });
    act(() => {
      result.current.onMsg({ t: 'canvas-session-status', sessionId: 'sid-1', status: 'review', at: 1 } as ServerMsg);
    });
    expect(result.current.canvasBoard.sessionStatus['sid-1']?.status).toBe('done');
  });

  it('the bulk broadcast applies every id', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({ t: 'canvas-session-status-bulk', sessionIds: ['a', 'b'], status: 'done', at: 5 } as ServerMsg);
    });
    expect(result.current.canvasBoard.sessionStatus.a).toEqual({ status: 'done', at: 5 });
    expect(result.current.canvasBoard.sessionStatus.b).toEqual({ status: 'done', at: 5 });
  });
});

describe('useCanvas — hide/unhide (board-persisted, canvas review item 2)', () => {
  it('onCanvasHideSession adds the id optimistically and sends the wire frame', () => {
    const localSend = vi.fn(() => true);
    const { result } = renderHook(() => useCanvas(localSend));
    act(() => { result.current.onCanvasHideSession('sid-1'); });
    expect(result.current.canvasBoard.hiddenSessions).toEqual(['sid-1']);
    expect(localSend).toHaveBeenCalledWith({ t: 'canvas-session-hide', sessionId: 'sid-1' });
  });

  it('onCanvasUnhideAllSessions clears the list and sends the wire frame', () => {
    const localSend = vi.fn(() => true);
    const { result } = renderHook(() => useCanvas(localSend));
    act(() => { result.current.onCanvasHideSession('sid-1'); });
    act(() => { result.current.onCanvasUnhideAllSessions(); });
    expect(result.current.canvasBoard.hiddenSessions).toEqual([]);
    expect(localSend).toHaveBeenCalledWith({ t: 'canvas-session-unhide-all' });
  });

  it('a stale canvas-board frame within the grace window does not clobber an optimistic hide', () => {
    const localSend = vi.fn(() => true);
    const { result } = renderHook(() => useCanvas(localSend));
    act(() => { result.current.onCanvasHideSession('sid-1'); });
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] }, flowRuns: [],
      } as ServerMsg);
    });
    expect(result.current.canvasBoard.hiddenSessions).toEqual(['sid-1']);
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

describe('useCanvas — canvas-board from an older server', () => {
  it('defaults every missing board field so the canvas never reads a property of undefined', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({ t: 'canvas-board', board: { cards: [], pos: {} } } as unknown as ServerMsg);
    });
    expect(result.current.canvasBoard.budgets).toEqual({});
    expect(result.current.canvasBoard.flows).toEqual([]);
    expect(result.current.canvasBoard.sessionStatus).toEqual({});
    expect(result.current.canvasBoard.hiddenSessions).toEqual([]);
  });
});

describe('useCanvas — writes while the socket is down', () => {
  it('queues a card save and replays it on reconnect instead of dropping it', () => {
    const sent: unknown[] = [];
    let online = false;
    const s = vi.fn((m: unknown) => { if (!online) return false; sent.push(m); return true; });
    const { result } = renderHook(() => useCanvas(s as never));
    const unsub = subscribeToast(() => {});
    const card = { id: 'card-1', title: 'Novo', prompt: 'faz X', status: 'todo', createdAt: 1 } as never;
    act(() => result.current.onCanvasCardSave(card));
    expect(sent).toEqual([]);
    online = true;
    act(() => result.current.onOrchestratorReconnect());
    expect(sent).toContainEqual({ t: 'canvas-card-save', card });
    unsub();
  });
});
