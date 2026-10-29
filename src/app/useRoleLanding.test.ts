// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoleLanding } from './useRoleLanding';
import type { Route } from '../useRoute';
import type { NavRole } from '../components/chrome/nav-routes';

type P = { route: Route; capsKnown: boolean; role: NavRole };
function mount(initial: P) {
  const nav = vi.fn();
  const h = renderHook((p: P) => useRoleLanding({ ...p, nav }), { initialProps: initial });
  return { nav, rerender: h.rerender };
}

describe('useRoleLanding', () => {
  it('a student opening the root stays on the home chat', () => {
    expect(mount({ route: '/', capsKnown: true, role: 'student' }).nav).not.toHaveBeenCalled();
  });
  it('waits for caps before moving anyone', () => {
    const { nav, rerender } = mount({ route: '/', capsKnown: false, role: 'student' });
    expect(nav).not.toHaveBeenCalled();
    rerender({ route: '/equipe/rotinas', capsKnown: true, role: 'student' });
    expect(nav).toHaveBeenCalledWith('/');
  });
  it('a chat URL stays, and going back to chat later is not undone', () => {
    const { nav, rerender } = mount({ route: '/', capsKnown: true, role: 'student' });
    expect(nav).not.toHaveBeenCalled();
    rerender({ route: '/', capsKnown: true, role: 'student' });
    expect(nav).not.toHaveBeenCalled();
  });
  it('a route outside the student menu always goes home', () => {
    for (const route of ['/configuracoes/uso', '/canvas', '/equipe/rotinas', '/equipe/memoria'] as Route[]) {
      expect(mount({ route, capsKnown: true, role: 'student' }).nav).toHaveBeenCalledWith('/');
    }
  });
  it('admin stays on its own routes', () => {
    expect(mount({ route: '/', capsKnown: true, role: 'admin' }).nav).not.toHaveBeenCalled();
    expect(mount({ route: '/canvas', capsKnown: true, role: 'admin' }).nav).not.toHaveBeenCalled();
    expect(mount({ route: '/conexoes', capsKnown: true, role: 'admin' }).nav).not.toHaveBeenCalled();
    expect(mount({ route: '/ds', capsKnown: true, role: 'admin' }).nav).not.toHaveBeenCalled();
  });
  it('root is never moved', () => {
    for (const route of ['/', '/canvas', '/conexoes', '/ds'] as Route[]) {
      expect(mount({ route, capsKnown: true, role: 'root' }).nav).not.toHaveBeenCalled();
    }
  });
});
