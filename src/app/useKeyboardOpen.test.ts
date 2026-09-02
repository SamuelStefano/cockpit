// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyboardOpen } from './useKeyboardOpen';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    addListener: () => {}, removeListener: () => {},
  }));
}

function stubViewport(height: number) {
  const listeners: { type: string; fn: () => void }[] = [];
  const vv = {
    height,
    addEventListener: (type: string, fn: () => void) => { listeners.push({ type, fn }); },
    removeEventListener: (type: string, fn: () => void) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  vi.stubGlobal('visualViewport', vv);
  return {
    vv,
    resize(h: number) {
      vv.height = h;
      act(() => { for (const l of [...listeners]) if (l.type === 'resize') l.fn(); });
    },
    listenerCount: () => listeners.length,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('useKeyboardOpen', () => {
  it('acusa teclado quando o viewport visível cai abaixo de 75% da janela', () => {
    stubMatchMedia(false);
    vi.stubGlobal('innerHeight', 844);
    stubViewport(420);
    expect(renderHook(() => useKeyboardOpen()).result.current).toBe(true);
  });

  it('fica falso com a janela inteira visível', () => {
    stubMatchMedia(false);
    vi.stubGlobal('innerHeight', 844);
    stubViewport(844);
    expect(renderHook(() => useKeyboardOpen()).result.current).toBe(false);
  });

  it('reage ao resize do visualViewport', () => {
    stubMatchMedia(false);
    vi.stubGlobal('innerHeight', 844);
    const vp = stubViewport(844);
    const { result } = renderHook(() => useKeyboardOpen());
    expect(result.current).toBe(false);
    vp.resize(400);
    expect(result.current).toBe(true);
  });

  // resizes-content encolhe a janela inteira: a razão empata em 1 e só a media
  // query curta denuncia o teclado.
  it('acusa teclado quando a janela inteira encolheu', () => {
    stubMatchMedia(true);
    vi.stubGlobal('innerHeight', 420);
    stubViewport(420);
    expect(renderHook(() => useKeyboardOpen()).result.current).toBe(true);
  });

  it('cai na media query quando não existe visualViewport', () => {
    stubMatchMedia(true);
    vi.stubGlobal('visualViewport', undefined);
    expect(renderHook(() => useKeyboardOpen()).result.current).toBe(true);
    stubMatchMedia(false);
    expect(renderHook(() => useKeyboardOpen()).result.current).toBe(false);
  });

  it('solta os listeners do visualViewport no unmount', () => {
    stubMatchMedia(false);
    vi.stubGlobal('innerHeight', 844);
    const vp = stubViewport(844);
    const { unmount } = renderHook(() => useKeyboardOpen());
    expect(vp.listenerCount()).toBe(2);
    unmount();
    expect(vp.listenerCount()).toBe(0);
  });
});
