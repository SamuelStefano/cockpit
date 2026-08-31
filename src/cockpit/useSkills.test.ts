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

describe('useSkills', () => {
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
});
