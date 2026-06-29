// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackgroundAgents } from './use-background-agents';
import type { BgAgent } from '../../../shared/protocol';

const T0 = 1_700_000_000_000;
function running(id: string, startedAt = T0, tokens = 0): BgAgent {
  return { id, label: `agente ${id}`, startedAt, tokens, status: 'running', durationMs: 0 };
}

describe('useBackgroundAgents', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0 + 5000); });
  afterEach(() => vi.useRealTimers());

  it('lista agentes rodando com tempo decorrido client-side', () => {
    const { result } = renderHook(() => useBackgroundAgents([running('a')]));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].status).toBe('running');
    expect(result.current[0].elapsedMs).toBe(5000);
  });

  it('tica o cronômetro sem novo evento', () => {
    const { result } = renderHook(() => useBackgroundAgents([running('a')]));
    expect(result.current[0].elapsedMs).toBe(5000);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current[0].elapsedMs).toBe(8000);
  });

  it('mantém o agente concluído no linger e some depois', () => {
    const done: BgAgent = { ...running('a'), status: 'done', durationMs: 4200 };
    const { result, rerender } = renderHook(({ a }) => useBackgroundAgents(a), {
      initialProps: { a: [running('a')] as BgAgent[] },
    });
    expect(result.current[0].status).toBe('running');
    // Backend reporta done e depois para de listar.
    rerender({ a: [done] });
    expect(result.current[0].status).toBe('done');
    rerender({ a: [] as BgAgent[] });
    expect(result.current).toHaveLength(1); // ainda no linger
    expect(result.current[0].status).toBe('done');
    act(() => { vi.advanceTimersByTime(4500); }); // > DONE_LINGER_MS
    expect(result.current).toHaveLength(0);
  });

  it('agente que some sem virar done explícito também fecha o ciclo', () => {
    const { result, rerender } = renderHook(({ a }) => useBackgroundAgents(a), {
      initialProps: { a: [running('a')] as BgAgent[] },
    });
    rerender({ a: [] as BgAgent[] });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].status).toBe('done');
  });

  it('nada visível => lista vazia', () => {
    const { result } = renderHook(() => useBackgroundAgents(undefined));
    expect(result.current).toHaveLength(0);
  });
});
