// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DropApi } from '../../cockpit/useDrops';
import { useDropForm } from './useDropForm';

const apiWith = (onDropList: () => void, drops: DropApi['drops']): DropApi => ({
  drops, dropsLoaded: true, lastDrop: null, onDropList, onDropPut: vi.fn(), onDropRm: vi.fn(),
});

describe('useDropForm', () => {
  it('não repede a lista quando só a identidade do api muda', () => {
    const onDropList = vi.fn();
    const { rerender } = renderHook(({ api }: { api: DropApi }) => useDropForm(api, true), {
      initialProps: { api: apiWith(onDropList, []) },
    });
    expect(onDropList).toHaveBeenCalledTimes(1);
    // Cada frame `drops` cria um array novo e, com ele, um api novo.
    rerender({ api: apiWith(onDropList, []) });
    rerender({ api: apiWith(onDropList, []) });
    expect(onDropList).toHaveBeenCalledTimes(1);
  });

  it('pede a lista ao abrir', () => {
    const onDropList = vi.fn();
    const api = apiWith(onDropList, []);
    const { rerender } = renderHook(({ open }: { open: boolean }) => useDropForm(api, open), {
      initialProps: { open: false },
    });
    expect(onDropList).not.toHaveBeenCalled();
    rerender({ open: true });
    expect(onDropList).toHaveBeenCalledTimes(1);
  });
});
