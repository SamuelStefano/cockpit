// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useOverlays } from './useOverlays';

afterEach(cleanup);

describe('useOverlays', () => {
  it('começa tudo fechado', () => {
    const { result } = renderHook(() => useOverlays('/'));
    expect(result.current).toMatchObject({ drawer: false, termSheet: false, routeMenu: false, palette: false, help: false });
  });

  // No mobile os dois ocupam a tela inteira: abrir um sem fechar o outro empilha
  // dois overlays e o de baixo fica inalcançável.
  it('abrir o drawer fecha o menu de rotas', () => {
    const { result } = renderHook(() => useOverlays('/'));
    act(() => result.current.setRouteMenu(true));
    expect(result.current.routeMenu).toBe(true);
    act(() => result.current.setDrawer(true));
    expect(result.current.drawer).toBe(true);
    expect(result.current.routeMenu).toBe(false);
  });

  it('abrir o menu de rotas fecha o drawer', () => {
    const { result } = renderHook(() => useOverlays('/'));
    act(() => result.current.setDrawer(true));
    act(() => result.current.setRouteMenu(true));
    expect(result.current.routeMenu).toBe(true);
    expect(result.current.drawer).toBe(false);
  });

  it('fechar um não mexe no outro', () => {
    const { result } = renderHook(() => useOverlays('/'));
    act(() => result.current.setDrawer(true));
    act(() => result.current.setRouteMenu(false));
    expect(result.current.drawer).toBe(true);
  });

  // Drawer e sheet vivem no MobileLayout, que só monta na rota de chat: navegar
  // desmontava o DOM mas o estado ficava ligado, e o overlay reaparecia sozinho
  // ao voltar pra '/'.
  it('mudar de rota fecha drawer, sheet e menu', () => {
    const { result, rerender } = renderHook(({ route }) => useOverlays(route), { initialProps: { route: '/' } });
    act(() => {
      result.current.setDrawer(true);
      result.current.setTermSheet(true);
    });
    expect(result.current.drawer).toBe(true);
    rerender({ route: '/graph' });
    expect(result.current).toMatchObject({ drawer: false, termSheet: false, routeMenu: false });
  });

  // Paleta e ajuda são modais globais, montados fora do MobileLayout: fechar no
  // navegar tiraria da tela o próprio atalho que acabou de navegar.
  it('mudar de rota não fecha paleta nem ajuda', () => {
    const { result, rerender } = renderHook(({ route }) => useOverlays(route), { initialProps: { route: '/' } });
    act(() => {
      result.current.setPalette(true);
      result.current.setHelp(true);
    });
    rerender({ route: '/graph' });
    expect(result.current).toMatchObject({ palette: true, help: true });
  });
});
