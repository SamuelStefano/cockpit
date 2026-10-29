// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { isFocusMode, useFocusMode, blurActiveEditable } from './useFocusMode';

afterEach(() => { document.body.innerHTML = ''; });

describe('isFocusMode', () => {
  it('needs phone, keyboard and a non-empty draft', () => {
    expect(isFocusMode(true, true, 'oi')).toBe(true);
    expect(isFocusMode(false, true, 'oi')).toBe(false);
    expect(isFocusMode(true, false, 'oi')).toBe(false);
    expect(isFocusMode(true, true, '')).toBe(false);
  });

  it('ignores whitespace-only drafts', () => {
    expect(isFocusMode(true, true, ' \n ')).toBe(false);
  });
});

describe('useFocusMode', () => {
  it('exits when the draft empties or the keyboard closes', () => {
    const { result, rerender } = renderHook(({ k, d }) => useFocusMode(true, k, d), { initialProps: { k: true, d: 'a' } });
    expect(result.current).toBe(true);
    rerender({ k: true, d: '' });
    expect(result.current).toBe(false);
    rerender({ k: false, d: 'a' });
    expect(result.current).toBe(false);
  });
});

describe('blurActiveEditable', () => {
  it('blurs a focused textarea', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    expect(document.activeElement).toBe(ta);
    blurActiveEditable();
    expect(document.activeElement).not.toBe(ta);
  });
});
