// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditableTitle } from './useEditableTitle';

describe('useEditableTitle', () => {
  it('commit chama onRename com o valor aparado', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useEditableTitle({ id: 's1', title: 'Orig', onRename }));
    act(() => result.current.start());
    act(() => result.current.setDraft('  Novo  '));
    act(() => result.current.commit());
    expect(onRename).toHaveBeenCalledWith('s1', 'Novo');
    expect(result.current.editing).toBe(false);
  });

  it('vazio não renomeia e restaura o título', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useEditableTitle({ id: 's1', title: 'Orig', onRename }));
    act(() => result.current.start());
    act(() => result.current.setDraft('   '));
    act(() => result.current.commit());
    expect(onRename).not.toHaveBeenCalled();
    expect(result.current.draft).toBe('Orig');
  });

  it('valor igual ao atual não dispara rename', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useEditableTitle({ id: 's1', title: 'Orig', onRename }));
    act(() => result.current.start());
    act(() => result.current.setDraft('Orig'));
    act(() => result.current.commit());
    expect(onRename).not.toHaveBeenCalled();
  });

  it('cancel descarta a edição sem renomear', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useEditableTitle({ id: 's1', title: 'Orig', onRename }));
    act(() => result.current.start());
    act(() => result.current.setDraft('Descartar'));
    act(() => result.current.cancel());
    expect(onRename).not.toHaveBeenCalled();
    expect(result.current.draft).toBe('Orig');
    expect(result.current.editing).toBe(false);
  });

  it('sem onRename não entra em edição (start é no-op)', () => {
    const { result } = renderHook(() => useEditableTitle({ id: 's1', title: 'Orig' }));
    act(() => result.current.start());
    expect(result.current.editing).toBe(false);
  });
});
