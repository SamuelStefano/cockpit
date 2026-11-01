// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyboardViewport } from './useKeyboardViewport';

afterEach(() => vi.unstubAllGlobals());

function stubViewport(height: number) {
  const fns: (() => void)[] = [];
  const vv = { height, scale: 1, addEventListener: (_: string, fn: () => void) => fns.push(fn), removeEventListener: () => {} };
  vi.stubGlobal('visualViewport', vv);
  return (h: number) => { vv.height = h; act(() => fns.forEach((f) => f())); };
}

describe('useKeyboardViewport', () => {
  it('pins the app height while the keyboard covers the page and releases it after', () => {
    vi.stubGlobal('scrollTo', vi.fn());
    const resize = stubViewport(window.innerHeight);
    renderHook(() => useKeyboardViewport());
    const value = () => document.documentElement.style.getPropertyValue('--app-height');
    expect(value()).toBe('');
    resize(300);
    expect(value()).toBe('300px');
    resize(window.innerHeight);
    expect(value()).toBe('');
  });

  it('does not take a pinch zoom for the keyboard', () => {
    vi.stubGlobal('scrollTo', vi.fn());
    const resize = stubViewport(window.innerHeight);
    renderHook(() => useKeyboardViewport());
    (window.visualViewport as unknown as { scale: number }).scale = 3;
    resize(200);
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('');
  });
});
