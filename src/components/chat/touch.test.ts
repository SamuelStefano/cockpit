// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { isTouchMobile, isVirtualKeyboardOnly } from './touch';

function mockPointer(q: Record<string, boolean>, touchPoints = 0) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
  window.matchMedia = ((query: string) => ({ matches: q[query] ?? false })) as typeof window.matchMedia;
}

afterEach(() => { mockPointer({}); });

describe('isVirtualKeyboardOnly', () => {
  it('celular (ponteiro grosso, sem ponteiro fino) = teclado virtual', () => {
    mockPointer({ '(pointer: coarse)': true }, 5);
    expect(isVirtualKeyboardOnly()).toBe(true);
  });

  it('notebook com tela sensível continua com Enter de teclado físico', () => {
    mockPointer({ '(pointer: coarse)': false, '(any-pointer: fine)': true }, 10);
    expect(isTouchMobile()).toBe(true);
    expect(isVirtualKeyboardOnly()).toBe(false);
  });

  it('desktop sem toque', () => {
    mockPointer({ '(any-pointer: fine)': true });
    expect(isVirtualKeyboardOnly()).toBe(false);
  });
});
