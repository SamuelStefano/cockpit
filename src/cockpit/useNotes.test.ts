// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNotes } from './useNotes';
import type { ClientMsg } from '../../shared/protocol';

const montar = () => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return true; });
  return { ...renderHook(() => useNotes(send)), enviados };
};

describe('useNotes', () => {
  it('reivindica notes e sai de loaded=false', () => {
    const { result } = montar();
    expect(result.current.notesLoaded).toBe(false);
    act(() => { expect(result.current.onMsg({ t: 'notes', text: 'oi' })).toBe(true); });
    expect(result.current.notes).toBe('oi');
    expect(result.current.notesLoaded).toBe(true);
  });

  // Texto vazio é um estado legítimo (o usuário apagou tudo); sem o flag separado
  // a UI não sabe distinguir isso de "o snapshot ainda não chegou".
  it('marca loaded mesmo com texto vazio', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'notes', text: '' }); });
    expect(result.current.notesLoaded).toBe(true);
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'crons', items: [] })).toBe(false);
  });

  it('manda os frames de leitura e escrita', () => {
    const { result, enviados } = montar();
    act(() => { result.current.onNotesGet(); result.current.onNotesSave('texto'); });
    expect(enviados).toEqual([{ t: 'notes-get' }, { t: 'notes-save', text: 'texto' }]);
  });
});
