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

function focusTextarea() {
  const ta = document.createElement('textarea');
  document.body.appendChild(ta);
  ta.focus();
  return ta;
}

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

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
  // query curta (com um campo focado) denuncia o teclado.
  it('acusa teclado quando a janela inteira encolheu com um campo focado', () => {
    stubMatchMedia(true);
    vi.stubGlobal('innerHeight', 420);
    stubViewport(420);
    focusTextarea();
    expect(renderHook(() => useKeyboardOpen()).result.current).toBe(true);
  });

  // Celular deitado: janela baixa, nenhum campo focado — não é teclado.
  it('não acusa teclado em landscape sem campo de texto focado', () => {
    stubMatchMedia(true);
    vi.stubGlobal('innerHeight', 390);
    stubViewport(390);
    expect(renderHook(() => useKeyboardOpen()).result.current).toBe(false);
  });

  it('não conta botão focado como teclado', () => {
    stubMatchMedia(true);
    vi.stubGlobal('innerHeight', 390);
    stubViewport(390);
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(renderHook(() => useKeyboardOpen()).result.current).toBe(false);
  });

  it('reage ao foco e ao blur do campo', () => {
    stubMatchMedia(true);
    vi.stubGlobal('innerHeight', 390);
    stubViewport(390);
    const { result } = renderHook(() => useKeyboardOpen());
    expect(result.current).toBe(false);
    let ta!: HTMLTextAreaElement;
    act(() => { ta = focusTextarea(); });
    expect(result.current).toBe(true);
    act(() => { ta.blur(); });
    expect(result.current).toBe(false);
  });

  it('cai na media query quando não existe visualViewport', () => {
    stubMatchMedia(true);
    vi.stubGlobal('visualViewport', undefined);
    focusTextarea();
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
