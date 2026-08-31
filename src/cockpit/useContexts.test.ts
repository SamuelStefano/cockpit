// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useContexts } from './useContexts';
import type { ClientMsg } from '../../shared/protocol';

const montar = () => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return true; });
  return { ...renderHook(() => useContexts(send)), enviados };
};

describe('useContexts', () => {
  it('reivindica contexts e marca loaded mesmo vazio', () => {
    const { result } = montar();
    expect(result.current.ctxLoaded).toBe(false);
    act(() => { expect(result.current.onMsg({ t: 'contexts', items: [] })).toBe(true); });
    expect(result.current.ctxLoaded).toBe(true);
  });

  it('abre e fecha um contexto sem falar com o servidor no fechar', () => {
    const { result, enviados } = montar();
    act(() => { result.current.onCtxOpen('c1'); });
    act(() => { expect(result.current.onMsg({ t: 'context', id: 'c1', title: 'T', body: 'B' })).toBe(true); });
    expect(result.current.openContext).toEqual({ id: 'c1', title: 'T', body: 'B' });
    act(() => { result.current.onCtxClose(); });
    expect(result.current.openContext).toBe(null);
    expect(enviados).toEqual([{ t: 'ctx-open', id: 'c1' }]);
  });

  // 'context' e 'contexts' diferem por uma letra: um claim errado engoliria a lista.
  it('não confunde context com contexts', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'context', id: 'c', title: 't', body: 'b' }); });
    expect(result.current.ctxLoaded).toBe(false);
    expect(result.current.contexts).toEqual([]);
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'skills', items: [] })).toBe(false);
  });
});
