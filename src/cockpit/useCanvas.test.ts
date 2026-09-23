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
        board: { cards: [], pos: {}, flows: [] },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    expect(result.current.canvasFlowRuns.card1?.key).toBe('new-abc');
  });

  it('an empty flowRuns array leaves any existing entry alone (does not clear it)', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [] },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    act(() => {
      result.current.onMsg({ t: 'canvas-board', board: { cards: [], pos: {}, flows: [] }, flowRuns: [] } as ServerMsg);
    });
    expect(result.current.canvasFlowRuns.card1?.key).toBe('new-abc');
  });

  it('a repeated identical run for the same card does not change the object identity (no needless re-render trigger)', () => {
    const { result } = renderHook(() => useCanvas(send));
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [] },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    const before = result.current.canvasFlowRuns;
    act(() => {
      result.current.onMsg({
        t: 'canvas-board', board: { cards: [], pos: {}, flows: [] },
        flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }],
      } as ServerMsg);
    });
    expect(result.current.canvasFlowRuns).toBe(before);
  });
});
