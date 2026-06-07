// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoute } from './useRoute';

describe('useRoute', () => {
  beforeEach(() => history.replaceState(null, '', '/'));
  afterEach(() => history.replaceState(null, '', '/'));

  it('inicia na rota atual quando válida', () => {
    history.replaceState(null, '', '/admin');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/admin');
  });

  it('cai pra "/" quando o pathname não é uma rota conhecida', () => {
    history.replaceState(null, '', '/inexistente');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/');
  });

  it('nav troca rota e empurra no history', () => {
    const { result } = renderHook(() => useRoute());
    act(() => result.current.nav('/uso'));
    expect(result.current.route).toBe('/uso');
    expect(location.pathname).toBe('/uso');
  });

  it('nav pra rota atual é no-op (não duplica history)', () => {
    history.replaceState(null, '', '/skills');
    const { result } = renderHook(() => useRoute());
    const before = history.length;
    act(() => result.current.nav('/skills'));
    expect(history.length).toBe(before);
    expect(result.current.route).toBe('/skills');
  });

  it('reage a popstate (voltar/avançar) revalidando a rota', () => {
    const { result } = renderHook(() => useRoute());
    act(() => {
      history.pushState(null, '', '/docs');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.route).toBe('/docs');
  });
});
