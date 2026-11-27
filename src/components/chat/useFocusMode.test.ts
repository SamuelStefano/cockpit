// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { isFocusMode, useFocusMode, blurActiveEditable } from './useFocusMode';

afterEach(() => { document.body.innerHTML = ''; });

describe('isFocusMode', () => {
  it('needs phone, keyboard and the composer focused', () => {
    expect(isFocusMode(true, true, true)).toBe(true);
    expect(isFocusMode(false, true, true)).toBe(false);
    expect(isFocusMode(true, false, true)).toBe(false);
    expect(isFocusMode(true, true, false)).toBe(false);
  });
});

describe('useFocusMode', () => {
  it('follows composer focus, not the draft, and ignores other fields', () => {
    const composer = document.createElement('textarea');
    composer.setAttribute('aria-label', 'Escrever mensagem');
    const other = document.createElement('input');
    document.body.append(composer, other);
    const { result, rerender } = renderHook(({ k }) => useFocusMode(true, k), { initialProps: { k: true } });
    expect(result.current).toBe(false);
    act(() => composer.focus());
    expect(result.current).toBe(true);
    act(() => other.focus());
    expect(result.current).toBe(false);
    act(() => composer.focus());
    rerender({ k: false });
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
