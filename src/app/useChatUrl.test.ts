// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatUrl } from './useChatUrl';
import type { Session } from '../data/types';

const sess = (id: string): Session => ({ id, title: id, relative: '', snippet: '', mtime: 0, hasTerminal: false, active: false });

function setup(over: Partial<Parameters<typeof useChatUrl>[0]> = {}) {
  const navChat = vi.fn();
  const setActiveId = vi.fn();
  const base = { route: '/', chatId: '', navChat, activeId: 'a', setActiveId, sessions: [sess('a'), sess('b')], archived: [sess('z')], ...over };
  const hook = renderHook((p: Parameters<typeof useChatUrl>[0]) => useChatUrl(p), { initialProps: base });
  return { ...hook, navChat, setActiveId, base };
}

describe('useChatUrl', () => {
  it('URL com id conhecido troca a sessão ativa (voltar/avançar, link colado)', () => {
    const { setActiveId } = setup({ chatId: 'b' });
    expect(setActiveId).toHaveBeenCalledWith('b');
  });

  it('id arquivado também conta como conhecido', () => {
    const { setActiveId } = setup({ chatId: 'z' });
    expect(setActiveId).toHaveBeenCalledWith('z');
  });

  it('id desconhecido não abre chat vazio: fica na sessão atual e a URL é corrigida', () => {
    const { setActiveId, navChat } = setup({ chatId: 'morto' });
    expect(setActiveId).not.toHaveBeenCalled();
    expect(navChat).toHaveBeenCalledWith('a', true);
  });

  it('não troca sessão enquanto o restore pós-F5 ainda não escolheu uma', () => {
    const { setActiveId } = setup({ chatId: 'b', activeId: '' });
    expect(setActiveId).not.toHaveBeenCalled();
  });

  it('activeId derivado (new-xxx → uuid) corrige a URL com replace, sem empilhar history', () => {
    const { rerender, navChat, base } = setup({ activeId: 'new-1' });
    expect(navChat).not.toHaveBeenCalled();
    rerender({ ...base, activeId: 'uuid-1' });
    expect(navChat).toHaveBeenCalledWith('uuid-1', true);
  });

  it('rascunho new-xxx não vai pra URL', () => {
    const { navChat } = setup({ activeId: 'new-1' });
    expect(navChat).not.toHaveBeenCalled();
  });

  it('fora da view de chat a URL não é tocada', () => {
    const { navChat } = setup({ route: '/contextos' });
    expect(navChat).not.toHaveBeenCalled();
  });

  it('URL e sessão já casadas: nada a fazer além do replace idempotente', () => {
    const { setActiveId } = setup({ chatId: 'a' });
    expect(setActiveId).not.toHaveBeenCalled();
  });

  it('popstate pra outro chat não é desfeito pelo efeito de sincronia da URL', () => {
    const { rerender, navChat, setActiveId, base } = setup({ chatId: 'a' });
    navChat.mockClear();
    rerender({ ...base, chatId: 'b' });
    expect(setActiveId).toHaveBeenCalledWith('b');
    expect(navChat).not.toHaveBeenCalled();
  });
});
