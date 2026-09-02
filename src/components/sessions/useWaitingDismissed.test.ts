// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { pruneDismissed, useWaitingDismissed } from './useWaitingDismissed';
import { WAITING_DISMISSED_KEY } from '../../lib/prefs';
import type { Session } from '../../data/types';

const HOUR = 3_600_000;
const sess = (id: string, mtime: number, waiting = false): Session =>
  ({ id, title: id, relative: '', snippet: '', mtime, hasTerminal: false, active: false, waiting });

describe('pruneDismissed', () => {
  it('mantém o mapa (mesma referência) quando nada mudou', () => {
    const map = { a: 100 };
    expect(pruneDismissed(map, [sess('a', 100, true)])).toBe(map);
  });

  it('solta a entrada quando a sessão perguntou de novo depois da dispensa', () => {
    expect(pruneDismissed({ a: 100 }, [sess('a', 200, true)])).toEqual({});
  });

  it('não solta por mtime novo sem pergunta pendente', () => {
    expect(pruneDismissed({ a: 100 }, [sess('a', 200, false)])).toEqual({ a: 100 });
  });
});

describe('useWaitingDismissed', () => {
  beforeEach(() => localStorage.clear());

  it('dismissWaiting guarda o mtime da sessão e persiste', () => {
    const list = [sess('a', 1_000, true)];
    const { result } = renderHook(() => useWaitingDismissed(list));
    act(() => result.current.dismissWaiting('a'));
    expect(result.current.dismissed.has('a')).toBe(true);
    expect(localStorage.getItem(`cockpit:${WAITING_DISMISSED_KEY}`)).toBe('{"a":1000}');
  });

  it('limpa a dispensa quando chega pergunta nova na mesma sessão', () => {
    const { result, rerender } = renderHook(
      ({ sessions }) => useWaitingDismissed(sessions),
      { initialProps: { sessions: [sess('a', Date.now() - HOUR, true)] } },
    );
    act(() => result.current.dismissWaiting('a'));
    expect(result.current.dismissed.has('a')).toBe(true);
    rerender({ sessions: [sess('a', Date.now(), true)] });
    expect(result.current.dismissed.has('a')).toBe(false);
  });
});
