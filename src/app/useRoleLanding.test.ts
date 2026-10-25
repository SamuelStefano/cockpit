// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoleLanding } from './useRoleLanding';
import type { Route } from '../useRoute';

type P = { route: Route; chatId: string; capsKnown: boolean; isAdmin: boolean };
function mount(initial: P) {
  const nav = vi.fn();
  const h = renderHook((p: P) => useRoleLanding({ ...p, nav }), { initialProps: initial });
  return { nav, rerender: h.rerender };
}

describe('useRoleLanding', () => {
  it('a student opening the root lands on the Equipe', () => {
    expect(mount({ route: '/', chatId: '', capsKnown: true, isAdmin: false }).nav).toHaveBeenCalledWith('/equipe');
  });
  it('waits for caps before moving anyone', () => {
    const { nav, rerender } = mount({ route: '/', chatId: '', capsKnown: false, isAdmin: false });
    expect(nav).not.toHaveBeenCalled();
    rerender({ route: '/', chatId: '', capsKnown: true, isAdmin: false });
    expect(nav).toHaveBeenCalledWith('/equipe');
  });
  it('a chat URL stays, and going back to chat later is not undone', () => {
    const { nav, rerender } = mount({ route: '/', chatId: 'abc', capsKnown: true, isAdmin: false });
    expect(nav).not.toHaveBeenCalled();
    rerender({ route: '/', chatId: '', capsKnown: true, isAdmin: false });
    expect(nav).not.toHaveBeenCalled();
  });
  it('a route outside the student menu always goes to the Equipe', () => {
    for (const route of ['/admin', '/canvas', '/pontos', '/crons'] as Route[]) {
      expect(mount({ route, chatId: '', capsKnown: true, isAdmin: false }).nav).toHaveBeenCalledWith('/equipe');
    }
  });
  it('admin is never moved', () => {
    expect(mount({ route: '/', chatId: '', capsKnown: true, isAdmin: true }).nav).not.toHaveBeenCalled();
    expect(mount({ route: '/canvas', chatId: '', capsKnown: true, isAdmin: true }).nav).not.toHaveBeenCalled();
  });
});
