// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktopVersion, focusDesktopWindow, inDesktopApp, setDesktopBadge } from './desktop';

const g = globalThis as { deckDesktop?: unknown };

afterEach(() => { delete g.deckDesktop; });

describe('desktop adapter', () => {
  it('is a no-op in the browser', () => {
    expect(inDesktopApp()).toBe(false);
    expect(desktopVersion()).toBeNull();
    expect(focusDesktopWindow()).toBe(false);
    expect(setDesktopBadge(2)).toBe(false);
  });

  it('tolerates an older shell without the method', () => {
    g.deckDesktop = { apiVersion: 0 };
    expect(inDesktopApp()).toBe(true);
    expect(focusDesktopWindow()).toBe(false);
    expect(setDesktopBadge(2)).toBe(false);
  });

  it('calls the shell when it has the method', () => {
    const setBadge = vi.fn();
    g.deckDesktop = { setBadge, appVersion: '0.1.0' };
    expect(setDesktopBadge(3)).toBe(true);
    expect(setBadge).toHaveBeenCalledWith(3);
    expect(desktopVersion()).toBe('0.1.0');
  });
});
