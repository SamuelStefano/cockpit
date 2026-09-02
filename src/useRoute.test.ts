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

  it('/c/<id> é a view de chat com o id extraído (decodificado)', () => {
    history.replaceState(null, '', '/c/abc%20def');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/');
    expect(result.current.chatId).toBe('abc def');
  });

  it('/c/ sem id cai em "/" sem chat', () => {
    history.replaceState(null, '', '/c/');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/');
    expect(result.current.chatId).toBe('');
  });

  it('navChat empurra /c/<id> no history e mantém a view de chat', () => {
    const { result } = renderHook(() => useRoute());
    const before = history.length;
    act(() => result.current.navChat('s1'));
    expect(location.pathname).toBe('/c/s1');
    expect(result.current.route).toBe('/');
    expect(result.current.chatId).toBe('s1');
    expect(history.length).toBe(before + 1);
  });

  it('navChat com replace corrige a URL sem empilhar history', () => {
    const { result } = renderHook(() => useRoute());
    act(() => result.current.navChat('new-1'));
    const before = history.length;
    act(() => result.current.navChat('uuid-1', true));
    expect(location.pathname).toBe('/c/uuid-1');
    expect(history.length).toBe(before);
  });

  it('navChat pro chat já na URL é no-op', () => {
    history.replaceState(null, '', '/c/s1');
    const { result } = renderHook(() => useRoute());
    const before = history.length;
    act(() => result.current.navChat('s1'));
    expect(history.length).toBe(before);
  });

  it('nav pra outra aba limpa o chatId', () => {
    history.replaceState(null, '', '/c/s1');
    const { result } = renderHook(() => useRoute());
    act(() => result.current.nav('/uso'));
    expect(result.current.chatId).toBe('');
    expect(location.pathname).toBe('/uso');
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
