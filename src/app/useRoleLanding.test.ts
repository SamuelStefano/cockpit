// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoleLanding } from './useRoleLanding';
import type { Route } from '../useRoute';
import type { NavRole } from '../components/chrome/nav-routes';

type P = { route: Route; chatId: string; capsKnown: boolean; role: NavRole };
function mount(initial: P) {
  const nav = vi.fn();
  const h = renderHook((p: P) => useRoleLanding({ ...p, nav }), { initialProps: initial });
  return { nav, rerender: h.rerender };
}

describe('useRoleLanding', () => {
  it('a student opening the root lands on the Equipe', () => {
    expect(mount({ route: '/', chatId: '', capsKnown: true, role: 'student' }).nav).toHaveBeenCalledWith('/equipe');
  });
  it('waits for caps before moving anyone', () => {
    const { nav, rerender } = mount({ route: '/', chatId: '', capsKnown: false, role: 'student' });
    expect(nav).not.toHaveBeenCalled();
    rerender({ route: '/', chatId: '', capsKnown: true, role: 'student' });
    expect(nav).toHaveBeenCalledWith('/equipe');
  });
  it('a chat URL stays, and going back to chat later is not undone', () => {
    const { nav, rerender } = mount({ route: '/', chatId: 'abc', capsKnown: true, role: 'student' });
    expect(nav).not.toHaveBeenCalled();
    rerender({ route: '/', chatId: '', capsKnown: true, role: 'student' });
    expect(nav).not.toHaveBeenCalled();
  });
  it('a route outside the student menu always goes to the Equipe', () => {
    for (const route of ['/painel', '/canvas', '/pontos', '/equipe/rotinas'] as Route[]) {
      expect(mount({ route, chatId: '', capsKnown: true, role: 'student' }).nav).toHaveBeenCalledWith('/equipe');
    }
  });
  it('admin stays on its own routes', () => {
    expect(mount({ route: '/', chatId: '', capsKnown: true, role: 'admin' }).nav).not.toHaveBeenCalled();
    expect(mount({ route: '/canvas', chatId: '', capsKnown: true, role: 'admin' }).nav).not.toHaveBeenCalled();
    expect(mount({ route: '/painel', chatId: '', capsKnown: true, role: 'admin' }).nav).not.toHaveBeenCalled();
    expect(mount({ route: '/ds', chatId: '', capsKnown: true, role: 'admin' }).nav).not.toHaveBeenCalled();
  });
  it('admin opening /pontos goes to chat (root only)', () => {
    expect(mount({ route: '/pontos', chatId: '', capsKnown: true, role: 'admin' }).nav).toHaveBeenCalledWith('/');
  });
  it('root is never moved', () => {
    for (const route of ['/', '/pontos', '/painel', '/ds'] as Route[]) {
      expect(mount({ route, chatId: '', capsKnown: true, role: 'root' }).nav).not.toHaveBeenCalled();
    }
  });
});
