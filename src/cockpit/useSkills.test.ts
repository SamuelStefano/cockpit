// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSkills } from './useSkills';
import type { ClientMsg } from '../../shared/protocol';

const montar = () => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return true; });
  return { ...renderHook(() => useSkills(send)), enviados };
};

const toasts: { text: string; tone?: string }[] = [];
vi.mock('../components/primitives/toast-bus', () => ({
  toast: (text: string, opts?: { tone?: string }) => { toasts.push({ text, tone: opts?.tone }); },
}));

describe('useSkills', () => {
  it('instalação parcial diz o que entrou junto com o que falhou', () => {
    toasts.length = 0;
    const { result, enviados } = montar();
    act(() => { result.current.onRegistryInstall('pack-x', [{ slug: 'a', kind: 'skill' } as never]); });
    const sent = enviados.at(-1) as { reqId: string };
    expect(result.current.installing.has('pack-x')).toBe(true);
    act(() => {
      result.current.onMsg({ t: 'registry-install-result', reqId: sent.reqId, ok: false, installed: ['a', 'b'], skipped: [], error: 'c: boom' });
    });
    expect(result.current.installing.has('pack-x')).toBe(false);
    const last = toasts.at(-1)!;
    expect(last.tone).toBe('error');
    expect(last.text).toContain('2 skills instaladas');
    expect(last.text).toContain('c: boom');
  });

  it('reivindica skills e marca loaded mesmo vazio', () => {
    const { result } = montar();
    expect(result.current.skillsLoaded).toBe(false);
    act(() => { expect(result.current.onMsg({ t: 'skills', items: [] })).toBe(true); });
    expect(result.current.skillsLoaded).toBe(true);
  });

  it('abre e fecha uma skill', () => {
    const { result, enviados } = montar();
    act(() => { result.current.onSkillList(); result.current.onSkillOpen('s1'); });
    act(() => { expect(result.current.onMsg({ t: 'skill', id: 's1', name: 'N', body: 'B' })).toBe(true); });
    expect(result.current.openSkill).toEqual({ id: 's1', name: 'N', body: 'B' });
    act(() => { result.current.onSkillClose(); });
    expect(result.current.openSkill).toBe(null);
    expect(enviados).toEqual([{ t: 'skill-list' }, { t: 'skill-open', id: 's1' }]);
  });

  // 'skill' e 'skills' diferem por uma letra: um claim errado engoliria a lista.
  it('não confunde skill com skills', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'skill', id: 's', name: 'n', body: 'b' }); });
    expect(result.current.skillsLoaded).toBe(false);
    expect(result.current.skills).toEqual([]);
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'contexts', items: [] })).toBe(false);
  });

  it('a reply arriving after close does not reopen the modal', () => {
    const { result } = montar();
    act(() => { result.current.onSkillOpen('a'); result.current.onSkillClose(); });
    act(() => { result.current.onMsg({ t: 'skill', id: 'a', name: 'n', body: 'b' }); });
    expect(result.current.openSkill).toBe(null);
  });

  it('a slow reply for an earlier click does not replace the one asked last', () => {
    const { result } = montar();
    act(() => { result.current.onSkillOpen('a'); result.current.onSkillOpen('b'); });
    act(() => { result.current.onMsg({ t: 'skill', id: 'b', name: 'n', body: 'b' }); result.current.onMsg({ t: 'skill', id: 'a', name: 'n', body: 'b' }); });
    expect(result.current.openSkill?.id).toBe('b');
  });
});
