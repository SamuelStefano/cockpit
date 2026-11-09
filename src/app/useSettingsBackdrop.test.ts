// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Route } from '../useRoute';
import { isSettingsRoute, useSettingsBackdrop } from './useSettingsBackdrop';

afterEach(() => history.replaceState(null, '', '/'));

describe('isSettingsRoute', () => {
  it('matches the settings root and its sections only', () => {
    expect(isSettingsRoute('/configuracoes')).toBe(true);
    expect(isSettingsRoute('/configuracoes/uso')).toBe(true);
    expect(isSettingsRoute('/')).toBe(false);
    expect(isSettingsRoute('/prs')).toBe(false);
  });
});

describe('useSettingsBackdrop', () => {
  it('keeps the previous screen underneath and returns to its exact URL', () => {
    history.replaceState(null, '', '/c/abc');
    const { result, rerender } = renderHook(({ route }) => useSettingsBackdrop(route), { initialProps: { route: '/' as Route } });
    expect(result.current.open).toBe(false);
    history.pushState(null, '', '/configuracoes/uso');
    rerender({ route: '/configuracoes/uso' });
    expect(result.current.open).toBe(true);
    expect(result.current.viewRoute).toBe('/');
    result.current.close();
    expect(location.pathname).toBe('/c/abc');
  });

  it('falls back to the chat on a cold load into settings', () => {
    history.replaceState(null, '', '/configuracoes');
    const { result } = renderHook(() => useSettingsBackdrop('/configuracoes'));
    expect(result.current.viewRoute).toBe('/');
    result.current.close();
    expect(location.pathname).toBe('/');
  });

  it('keeps a non-chat backdrop such as the PR hub', () => {
    history.replaceState(null, '', '/prs');
    const { result, rerender } = renderHook(({ route }) => useSettingsBackdrop(route), { initialProps: { route: '/prs' as Route } });
    rerender({ route: '/configuracoes' });
    expect(result.current.viewRoute).toBe('/prs');
  });
});
