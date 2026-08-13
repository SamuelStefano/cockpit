// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQueuedBanner } from './useQueuedBanner';

function setup(queued: string[]) {
  const onMove = vi.fn();
  const onEdit = vi.fn();
  const hook = renderHook((p: { queued: string[] }) => useQueuedBanner(p.queued, onMove, onEdit), {
    initialProps: { queued },
  });
  return { hook, onMove, onEdit };
}

describe('useQueuedBanner edição', () => {
  it('startEdit carrega o texto do item e commit envia o rascunho', () => {
    const { hook, onEdit } = setup(['a', 'b']);
    act(() => hook.result.current.startEdit(1));
    expect(hook.result.current.draft).toBe('b');
    act(() => hook.result.current.setDraft('b corrigido'));
    act(() => hook.result.current.commitEdit());
    expect(onEdit).toHaveBeenCalledWith(1, 'b corrigido');
    expect(hook.result.current.editing).toBeNull();
  });

  it('commit sem mudança (ou vazio) não chama onEdit', () => {
    const { hook, onEdit } = setup(['a']);
    act(() => hook.result.current.startEdit(0));
    act(() => hook.result.current.commitEdit());
    act(() => hook.result.current.startEdit(0));
    act(() => hook.result.current.setDraft('   '));
    act(() => hook.result.current.commitEdit());
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('drenar o topo desloca a edição pro novo índice do MESMO item', () => {
    const { hook } = setup(['a', 'b']);
    act(() => hook.result.current.startEdit(1));
    hook.rerender({ queued: ['b'] });
    expect(hook.result.current.editing).toBe(0);
    expect(hook.result.current.draft).toBe('b');
  });

  it('o item em edição sumir da fila fecha o textarea (não pousa no vizinho)', () => {
    const { hook } = setup(['a', 'b']);
    act(() => hook.result.current.startEdit(1));
    hook.rerender({ queued: ['a'] });
    expect(hook.result.current.editing).toBeNull();
  });
});

describe('useQueuedBanner disparo em paralelo', () => {
  it('toggleBg abre um item só e o segundo clique fecha', () => {
    const { hook } = setup(['a', 'b']);
    act(() => hook.result.current.toggleBg(1));
    expect(hook.result.current.bgOpen).toBe(1);
    act(() => hook.result.current.toggleBg(0));
    expect(hook.result.current.bgOpen).toBe(0);
    act(() => hook.result.current.toggleBg(0));
    expect(hook.result.current.bgOpen).toBeNull();
  });

  it('o seletor segue o MESMO item quando a fila desloca', () => {
    const { hook } = setup(['a', 'b']);
    act(() => hook.result.current.toggleBg(1));
    hook.rerender({ queued: ['b'] });
    expect(hook.result.current.bgOpen).toBe(0);
  });

  it('o item disparado sumir da fila fecha o seletor', () => {
    const { hook } = setup(['a', 'b']);
    act(() => hook.result.current.toggleBg(1));
    hook.rerender({ queued: ['a'] });
    expect(hook.result.current.bgOpen).toBeNull();
  });
});
