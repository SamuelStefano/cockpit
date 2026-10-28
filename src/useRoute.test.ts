// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoute } from './useRoute';

describe('useRoute', () => {
  beforeEach(() => history.replaceState(null, '', '/'));
  afterEach(() => history.replaceState(null, '', '/'));

  it('inicia na rota atual quando válida', () => {
    history.replaceState(null, '', '/configuracoes/pessoas');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/configuracoes/pessoas');
  });

  it('/painel e /uso redirecionam pra Configurações', () => {
    for (const [from, to] of [['/painel', '/configuracoes/maquina'], ['/painel#overview', '/configuracoes/maquina'], ['/painel#accounts', '/configuracoes/pessoas'], ['/uso', '/configuracoes/uso']]) {
      history.replaceState(null, '', from);
      const { result, unmount } = renderHook(() => useRoute());
      expect(result.current.route).toBe(to);
      expect(location.pathname + location.hash).toBe(to);
      unmount();
    }
  });

  it('abas de Conexões continuam em /painel até a fatia 22b', () => {
    history.replaceState(null, '', '/painel#models');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/painel');
  });

  it('/admin vira /painel preservando o hash da sub-aba', () => {
    history.replaceState(null, '', '/admin#models');
    const before = history.length;
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/painel');
    expect(location.pathname + location.hash).toBe('/painel#models');
    expect(history.length).toBe(before);
  });

  it('telas desligadas (/notas, /play, /harness) redirecionam pro chat', () => {
    for (const p of ['/notas', '/play', '/harness']) {
      history.replaceState(null, '', p);
      const { result, unmount } = renderHook(() => useRoute());
      expect(result.current.route).toBe('/');
      expect(location.pathname).toBe('/');
      unmount();
    }
  });

  it('um voltar pra URL antiga também redireciona', () => {
    const { result } = renderHook(() => useRoute());
    act(() => {
      history.pushState(null, '', '/admin#host');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.route).toBe('/configuracoes/maquina');
    expect(location.pathname + location.hash).toBe('/configuracoes/maquina');
  });

  it('cai pra "/" quando o pathname não é uma rota conhecida', () => {
    history.replaceState(null, '', '/inexistente');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/');
  });

  it('nav troca rota e empurra no history', () => {
    const { result } = renderHook(() => useRoute());
    act(() => result.current.nav('/configuracoes/uso'));
    expect(result.current.route).toBe('/configuracoes/uso');
    expect(location.pathname).toBe('/configuracoes/uso');
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
    act(() => result.current.nav('/configuracoes/uso'));
    expect(result.current.chatId).toBe('');
    expect(location.pathname).toBe('/configuracoes/uso');
  });

  it('reage a popstate (voltar/avançar) revalidando a rota', () => {
    const { result } = renderHook(() => useRoute());
    act(() => {
      history.pushState(null, '', '/docs');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.route).toBe('/docs');
  });

  it('parses /agentes/:id with its tab, and the bare list', () => {
    history.replaceState(null, '', '/agentes/ana01?aba=rotinas');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toMatchObject({ route: '/agentes', agentId: 'ana01', agentTab: 'rotinas' });
    act(() => result.current.navAgent(''));
    expect(location.pathname).toBe('/agentes');
    expect(result.current).toMatchObject({ route: '/agentes', agentId: '' });
  });

  it('navAgent writes the tab in the query and falls back to perfil on a bad one', () => {
    const { result } = renderHook(() => useRoute());
    act(() => result.current.navAgent('novo'));
    expect(location.pathname + location.search).toBe('/agentes/novo');
    act(() => result.current.navAgent('ana01', 'arquivos'));
    expect(location.pathname + location.search).toBe('/agentes/ana01?aba=arquivos');
    history.replaceState(null, '', '/agentes/ana01?aba=zzz');
    const again = renderHook(() => useRoute());
    expect(again.result.current.agentTab).toBe('perfil');
  });

  it('/skills/<id> abre a página da skill', () => {
    history.replaceState(null, '', '/skills/deck-ops');
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe('/skills');
    expect(result.current.skillId).toBe('deck-ops');
    act(() => result.current.navSkill(''));
    expect(location.pathname).toBe('/skills');
    expect(result.current.skillId).toBe('');
  });
});
