// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DropApi } from '../../cockpit/useDrops';
import { useDropForm } from './useDropForm';

const apiWith = (onDropList: () => void, drops: DropApi['drops']): DropApi => ({
  drops, dropsLoaded: true, lastDrop: null, onDropList, onDropPut: vi.fn(() => true), onDropRm: vi.fn(),
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

  it('socket fechado preserva o segredo e avisa', () => {
    const onDropPut = vi.fn(() => false);
    const api = { ...apiWith(vi.fn(), []), onDropPut };
    const { result } = renderHook(() => useDropForm(api, true));
    act(() => { result.current.setSlug('token'); result.current.setContent('segredo'); });
    act(() => { result.current.submit(); });
    expect(result.current.content).toBe('segredo');
    expect(result.current.erro).toContain('sem conexão');
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

  const pick = async (result: { current: ReturnType<typeof useDropForm> }, name: string, bytes: Uint8Array<ArrayBuffer>) => {
    const file = new File([bytes], name);
    await act(async () => { result.current.onFile({ target: { files: [file], value: '' } } as never); await new Promise((r) => setTimeout(r, 20)); });
  };

  it('text file: prefills slug, hides content, sends the original frame', async () => {
    const api = apiWith(vi.fn(), []);
    const { result } = renderHook(() => useDropForm(api, true));
    await pick(result, 'deploy.env', new TextEncoder().encode('A=1'));
    expect(result.current.slug).toBe('deploy.env');
    expect(result.current.content).toBe('');
    expect(result.current.file).toEqual({ name: 'deploy.env', bytes: 3, binary: false });
    act(() => { result.current.submit(); });
    expect(api.onDropPut).toHaveBeenCalledWith('deploy.env', 'A=1', undefined, undefined);
    expect(result.current.file).toBeNull();
  });

  it('binary file goes as base64', async () => {
    const api = apiWith(vi.fn(), []);
    const { result } = renderHook(() => useDropForm(api, true));
    await pick(result, 'asc-api-key.p8', new Uint8Array([0, 1, 2]));
    expect(result.current.slug).toBe('asc-api-key.p8');
    act(() => { result.current.submit(); });
    expect(api.onDropPut).toHaveBeenCalledWith('asc-api-key.p8', 'AAEC', undefined, 'base64');
  });

  it('old agent saving base64 text: removes the drop and reports', async () => {
    const onDropRm = vi.fn();
    let api = { ...apiWith(vi.fn(), []), onDropRm };
    const { result, rerender } = renderHook(() => useDropForm(api, true));
    await pick(result, 'k.p8', new Uint8Array([0, 1, 2]));
    act(() => { result.current.submit(); });
    api = { ...api, lastDrop: { slug: 'k.p8', path: '/x', bytes: 4, sha256: 'a', mtime: 1 } };
    rerender();
    expect(onDropRm).toHaveBeenCalledWith('k.p8');
    expect(result.current.erro).toContain('antigo');
    expect(result.current.ref).toBeNull();
  });
});
