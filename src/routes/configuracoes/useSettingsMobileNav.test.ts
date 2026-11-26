// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettingsMobileNav } from './useSettingsMobileNav';

const base = { count: 3, initiallyOpen: false };

describe('useSettingsMobileNav', () => {
  it('shows the list first on a phone and the section after select', () => {
    const { result } = renderHook(() => useSettingsMobileNav({ ...base, isMobile: true }));
    expect(result.current.showList).toBe(true);
    act(() => result.current.select());
    expect(result.current.showList).toBe(false);
    expect(result.current.showBack).toBe(true);
    act(() => result.current.back());
    expect(result.current.showList).toBe(true);
  });
  it('opens straight on a deep-linked section', () => {
    const { result } = renderHook(() => useSettingsMobileNav({ ...base, isMobile: true, initiallyOpen: true }));
    expect(result.current.showList).toBe(false);
  });
  it('never shows list or back on desktop or with one section', () => {
    const d = renderHook(() => useSettingsMobileNav({ ...base, isMobile: false })).result.current;
    expect(d.showList || d.showBack).toBe(false);
    const one = renderHook(() => useSettingsMobileNav({ ...base, isMobile: true, count: 1 })).result.current;
    expect(one.showList || one.showBack).toBe(false);
  });
});
