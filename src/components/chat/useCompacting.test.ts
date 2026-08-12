// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCompacting } from './useCompacting';
import { COMPACT_SILENCE_MS } from './compacting';
import { CONTEXT_LIMIT } from '../../lib/format';
import type { Message } from '../../data/mock';

const cheio = Math.round(CONTEXT_LIMIT * 0.9);
const fala = (md: string): Message[] => [{ id: 'a1', role: 'assistant', blocks: [{ type: 'text', md }] }];
const msgs = fala('oi');

describe('useCompacting', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('acende depois do silêncio e devolve o começo dele', () => {
    const t0 = Date.now();
    const { result } = renderHook(() => useCompacting(msgs, true, cheio));
    expect(result.current).toBe(null);
    act(() => { vi.advanceTimersByTime(COMPACT_SILENCE_MS + 1000); });
    expect(result.current).toBe(t0);
  });

  it('frame novo apaga o indicador e a contagem recomeça do zero', () => {
    const { result, rerender } = renderHook(({ m }: { m: Message[] }) => useCompacting(m, true, cheio), {
      initialProps: { m: msgs },
    });
    act(() => { vi.advanceTimersByTime(COMPACT_SILENCE_MS + 1000); });
    expect(result.current).not.toBe(null);

    const t1 = Date.now();
    act(() => { rerender({ m: fala('oi la') }); });
    expect(result.current).toBe(null);

    act(() => { vi.advanceTimersByTime(COMPACT_SILENCE_MS + 1000); });
    expect(result.current).toBe(t1);
  });

  it('array novo com o mesmo conteúdo não zera o relógio (replay do reconnect)', () => {
    const { result, rerender } = renderHook(({ m }: { m: Message[] }) => useCompacting(m, true, cheio), {
      initialProps: { m: msgs },
    });
    act(() => { vi.advanceTimersByTime(COMPACT_SILENCE_MS - 2000); });
    act(() => { rerender({ m: [...msgs] }); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).not.toBe(null);
  });

  it('turno parado não acende nem com silêncio', () => {
    const { result } = renderHook(() => useCompacting(msgs, false, cheio));
    act(() => { vi.advanceTimersByTime(COMPACT_SILENCE_MS * 3); });
    expect(result.current).toBe(null);
  });

  it('turno que termina apaga o indicador aceso', () => {
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => useCompacting(msgs, on, cheio), {
      initialProps: { on: true },
    });
    act(() => { vi.advanceTimersByTime(COMPACT_SILENCE_MS + 1000); });
    expect(result.current).not.toBe(null);
    act(() => { rerender({ on: false }); });
    expect(result.current).toBe(null);
  });

  it('ferramenta aberta segura o indicador mesmo com o silêncio estourado', () => {
    const comTool: Message[] = [{
      id: 'a1', role: 'assistant',
      blocks: [{ type: 'tool', tool: { id: 't1', name: 'Bash', label: 'Bash', command: 'build', status: 'running', output: [] } }],
    }];
    const { result } = renderHook(() => useCompacting(comTool, true, cheio));
    act(() => { vi.advanceTimersByTime(COMPACT_SILENCE_MS * 3); });
    expect(result.current).toBe(null);
  });

  it('quota pausada não vira "compactando"', () => {
    const { result } = renderHook(() => useCompacting(msgs, true, cheio, true));
    act(() => { vi.advanceTimersByTime(COMPACT_SILENCE_MS * 3); });
    expect(result.current).toBe(null);
  });
});
