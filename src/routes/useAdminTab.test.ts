// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAdminTab } from './useAdminTab';
import { openAdminTab } from '../lib/admin-nav';

const KNOWN = ['overview', 'models'];

describe('useAdminTab', () => {
  it('opens the tab named in the hash and falls back to overview', () => {
    history.replaceState(null, '', '/admin#models');
    expect(renderHook(() => useAdminTab(KNOWN)).result.current[0]).toBe('models');
    history.replaceState(null, '', '/admin#bogus');
    expect(renderHook(() => useAdminTab(KNOWN)).result.current[0]).toBe('overview');
  });

  it('follows a deep link while mounted and writes the hash on select', () => {
    history.replaceState(null, '', '/admin');
    const { result } = renderHook(() => useAdminTab(KNOWN));
    act(() => openAdminTab('models'));
    expect(result.current[0]).toBe('models');
    act(() => result.current[1]('overview'));
    expect(location.hash).toBe('#overview');
  });
});
