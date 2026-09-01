// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCrons } from './useCrons';
import type { ClientMsg, Cron } from '../../shared/protocol';

const cron = (id: string): Cron => ({ id, name: id, prompt: 'p', schedule: { kind: 'daily', atMinute: 180 }, enabled: true, createdAt: 0 });

const montar = () => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return true; });
  return { ...renderHook(() => useCrons(send)), enviados };
};

describe('useCrons', () => {
  it('reivindica crons e marca loaded', () => {
    const { result } = montar();
    expect(result.current.cronsLoaded).toBe(false);
    act(() => { expect(result.current.onMsg({ t: 'crons', items: [cron('a')] })).toBe(true); });
    expect(result.current.crons.map((c) => c.id)).toEqual(['a']);
    expect(result.current.cronsLoaded).toBe(true);
  });

  // Zero agendamentos é estado final válido — o skeleton tem que sair mesmo assim.
  it('marca loaded com lista vazia', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'crons', items: [] }); });
    expect(result.current.cronsLoaded).toBe(true);
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'notes', text: '' })).toBe(false);
  });

  it('manda os quatro frames de ação', () => {
    const { result, enviados } = montar();
    const c = cron('x');
    act(() => {
      result.current.onCronsGet();
      result.current.onCronSave(c);
      result.current.onCronDelete('x');
      result.current.onCronRun('x');
    });
    expect(enviados).toEqual([
      { t: 'crons-get' },
      { t: 'cron-save', cron: c },
      { t: 'cron-delete', id: 'x' },
      { t: 'cron-run', id: 'x' },
    ]);
  });
});
