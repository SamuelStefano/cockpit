// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckUpdate } from './useDeckUpdate';

type Op = { ok: boolean; message: string } | null;

describe('useDeckUpdate lock', () => {
  it('stays locked when the previous banner auto-resets, releases on a real result', () => {
    const { result, rerender } = renderHook(({ op }: { op: Op }) => useDeckUpdate(op, vi.fn(), vi.fn()), { initialProps: { op: { ok: true, message: 'token salvo' } as Op } });
    act(() => { result.current.updateCli(); });
    expect(result.current.busy).toBe('cli');
    rerender({ op: null }); // the earlier banner clearing itself
    expect(result.current.busy).toBe('cli');
    rerender({ op: { ok: true, message: 'claude atualizado' } });
    expect(result.current.busy).toBeNull();
  });
});
