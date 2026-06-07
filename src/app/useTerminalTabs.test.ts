// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminalTabs } from './useTerminalTabs';
import type { TermApi } from '../useCockpit';

const fakeTerm = (): TermApi => ({
  attach: vi.fn(),
  detach: vi.fn(),
  input: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
});

describe('useTerminalTabs', () => {
  beforeEach(() => localStorage.clear());

  it('começa com o terminal seed e chama listTerms no mount', () => {
    const listTerms = vi.fn();
    const { result } = renderHook(() => useTerminalTabs(fakeTerm(), [], listTerms));
    expect(result.current.terminals).toEqual([{ id: 'main', name: 'shell' }]);
    expect(result.current.activeTermId).toBe('main');
    expect(listTerms).toHaveBeenCalledTimes(1);
  });

  it('attachable lista só descobertos que não estão abertos', () => {
    const { result } = renderHook(() => useTerminalTabs(fakeTerm(), ['main', 'term-200']));
    expect(result.current.attachable).toEqual(['term-200']);
  });

  it('handleAddTerm acrescenta uma aba nova e a torna ativa', () => {
    const { result } = renderHook(() => useTerminalTabs(fakeTerm()));
    act(() => result.current.handleAddTerm());
    expect(result.current.terminals).toHaveLength(2);
    expect(result.current.activeTermId).toBe(result.current.terminals[1].id);
  });

  it('attachExisting já aberto só seleciona, sem duplicar', () => {
    const { result } = renderHook(() => useTerminalTabs(fakeTerm()));
    act(() => result.current.attachExisting('main'));
    expect(result.current.terminals).toHaveLength(1);
    expect(result.current.activeTermId).toBe('main');
  });

  it('attachExisting novo adiciona aba e seleciona', () => {
    const { result } = renderHook(() => useTerminalTabs(fakeTerm(), ['term-300']));
    act(() => result.current.attachExisting('term-300'));
    expect(result.current.terminals.some((t) => t.id === 'term-300')).toBe(true);
    expect(result.current.activeTermId).toBe('term-300');
  });

  it('handleCloseTerm mata o pty e reseleciona a primeira aba quando fecha a ativa', () => {
    const term = fakeTerm();
    const { result } = renderHook(() => useTerminalTabs(term));
    act(() => result.current.handleAddTerm()); // cria 2ª, vira ativa
    const second = result.current.activeTermId;
    act(() => result.current.handleCloseTerm(second));
    expect(term.kill).toHaveBeenCalledWith(second);
    expect(result.current.terminals).toHaveLength(1);
    expect(result.current.activeTermId).toBe('main');
  });
});
