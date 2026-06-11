// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionRow } from './useSessionRow';
import type { Session } from '../../data/mock';

const sess = (over: Partial<Session> = {}): Session => ({ id: 's1', title: 'Título', ...over }) as Session;

describe('useSessionRow', () => {
  it('commit renomeia com o draft aparado e sai do modo edição', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useSessionRow({ s: sess(), onRename }));
    act(() => { result.current.setEditing(true); result.current.setDraft('  Novo  '); });
    act(() => result.current.commit());
    expect(onRename).toHaveBeenCalledWith('s1', 'Novo');
    expect(result.current.editing).toBe(false);
  });

  it('commit com draft vazio não renomeia e restaura o título', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useSessionRow({ s: sess({ title: 'Orig' }), onRename }));
    act(() => { result.current.setEditing(true); result.current.setDraft('   '); });
    act(() => result.current.commit());
    expect(onRename).not.toHaveBeenCalled();
    expect(result.current.draft).toBe('Orig');
    expect(result.current.editing).toBe(false);
  });

  it('commitDesc aceita vazio (limpa override) e chama onDescribe aparado', () => {
    const onDescribe = vi.fn();
    const { result } = renderHook(() => useSessionRow({ s: sess(), onRename: vi.fn(), onDescribe }));
    act(() => { result.current.setDescEditing(true); result.current.setDescDraft('  resumo  '); });
    act(() => result.current.commitDesc());
    expect(onDescribe).toHaveBeenCalledWith('s1', 'resumo');
    expect(result.current.descEditing).toBe(false);
  });

  it('commitTag normaliza (lowercase, espaços→hífen, corte em 24) e adiciona', () => {
    const onAddTag = vi.fn();
    const { result } = renderHook(() => useSessionRow({ s: sess(), onRename: vi.fn(), onAddTag }));
    act(() => { result.current.setTagging(true); result.current.setTagDraft('  Em Progresso  '); });
    act(() => result.current.commitTag());
    expect(onAddTag).toHaveBeenCalledWith('s1', 'em-progresso');
    expect(result.current.tagging).toBe(false);
    expect(result.current.tagDraft).toBe('');
  });

  it('commit vazio após rename remoto restaura o título ATUAL, não o do mount', () => {
    const onRename = vi.fn();
    const { result, rerender } = renderHook(({ s }) => useSessionRow({ s, onRename }), {
      initialProps: { s: sess({ title: 'Antigo' }) },
    });
    rerender({ s: sess({ title: 'Renomeado remoto' }) });
    act(() => { result.current.setEditing(true); result.current.setDraft('  '); });
    act(() => result.current.commit());
    expect(onRename).not.toHaveBeenCalled();
    expect(result.current.draft).toBe('Renomeado remoto');
  });

  it('commitTag vazio não adiciona tag', () => {
    const onAddTag = vi.fn();
    const { result } = renderHook(() => useSessionRow({ s: sess(), onRename: vi.fn(), onAddTag }));
    act(() => { result.current.setTagging(true); result.current.setTagDraft('   '); });
    act(() => result.current.commitTag());
    expect(onAddTag).not.toHaveBeenCalled();
    expect(result.current.tagging).toBe(false);
  });
});
