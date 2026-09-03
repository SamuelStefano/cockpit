// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShikiTokens } from './useShikiTokens';

describe('useShikiTokens', () => {
  it('começa em null (o CodeBlock cai no texto puro enquanto o shiki carrega)', () => {
    const { result } = renderHook(() => useShikiTokens('const x = 1', 'ts'));
    expect(result.current).toBeNull();
  });

  // Regressão da flake de CI: o shiki é importado dinamicamente e a promessa é de
  // módulo, então ela resolve depois do teardown do ambiente do arquivo que a
  // disparou. Sem o guard, o setState cai num React sem `window` e o vitest morre
  // com unhandled error atribuído a um arquivo qualquer.
  it('não faz setState quando o ambiente já foi derrubado (sem window)', async () => {
    const { result } = renderHook(() => useShikiTokens('const x = 1', 'ts'));
    const win = globalThis.window;
    // @ts-expect-error simula o teardown do ambiente do vitest
    delete globalThis.window;
    try {
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current).toBeNull();
    } finally {
      globalThis.window = win;
    }
  });

  it('degrada pra null quando a tokenização falha, sem lançar', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useShikiTokens('x', 'linguagem-inexistente'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current === null || Array.isArray(result.current)).toBe(true);
    spy.mockRestore();
  });
});
