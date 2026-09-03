// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDrops } from './useDrops';
import type { ClientMsg, DropRef } from '../../shared/protocol';

const ref: DropRef = { slug: 'env', path: '/home/x/.deck-drop/env', bytes: 12, sha256: 'a'.repeat(64), mtime: 1 };

const montar = () => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return true; });
  return { ...renderHook(() => useDrops(send)), enviados };
};

describe('useDrops', () => {
  it('reivindica drops e sai de loaded=false', () => {
    const { result } = montar();
    expect(result.current.dropsLoaded).toBe(false);
    act(() => { expect(result.current.onMsg({ t: 'drops', items: [ref] })).toBe(true); });
    expect(result.current.drops).toEqual([ref]);
    expect(result.current.dropsLoaded).toBe(true);
  });

  // O conteúdo só existe na resposta de drop-open. Guardá-lo aqui traria o segredo
  // pro estado do cliente — exatamente o que o drop evita.
  it('guarda a referência do frame drop e descarta o conteúdo', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'drop', ref, content: 'TOKEN=segredo' }); });
    expect(result.current.lastDrop).toEqual(ref);
    expect(JSON.stringify(result.current)).not.toContain('TOKEN=segredo');
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'notes', text: 'oi' })).toBe(false);
  });

  it('manda os frames de lista, gravação e remoção', () => {
    const { result, enviados } = montar();
    act(() => {
      result.current.onDropList();
      result.current.onDropPut('env', 'A=1', 60_000);
      result.current.onDropRm('env');
    });
    expect(enviados).toEqual([
      { t: 'drop-list' },
      { t: 'drop-put', slug: 'env', content: 'A=1', ttlMs: 60_000 },
      { t: 'drop-rm', slug: 'env' },
    ]);
  });
});
