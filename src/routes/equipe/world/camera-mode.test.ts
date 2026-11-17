import { describe, it, expect } from 'vitest';
import { clampZoom, fitZoom, initialWorldUi, isDemo, parseInitialMode, wheelZoom, worldUiReducer } from './camera-mode';

describe('worldUiReducer', () => {
  it('toggles between avatar and god mode', () => {
    const a = initialWorldUi();
    const g = worldUiReducer(a, { t: 'toggle-mode' });
    expect(g.mode).toBe('god');
    expect(worldUiReducer(g, { t: 'toggle-mode' }).mode).toBe('avatar');
  });

  it('keeps the same state object for a no-op set-mode and exit-recording', () => {
    const s = initialWorldUi('god');
    expect(worldUiReducer(s, { t: 'set-mode', mode: 'god' })).toBe(s);
    expect(worldUiReducer(s, { t: 'exit-recording' })).toBe(s);
  });

  it('toggles recording without touching the camera mode', () => {
    const s = worldUiReducer(initialWorldUi('god'), { t: 'toggle-recording' });
    expect(s).toEqual({ mode: 'god', recording: true });
    expect(worldUiReducer(s, { t: 'exit-recording' }).recording).toBe(false);
  });
});

describe('zoom helpers', () => {
  it('clamps zoom to the allowed range', () => {
    expect(clampZoom(0.01)).toBe(0.4);
    expect(clampZoom(99)).toBe(5);
    expect(clampZoom(2)).toBe(2);
  });

  it('zooms in on wheel up and out on wheel down', () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
    expect(wheelZoom(1, 100)).toBeLessThan(1);
  });

  it('fits the world inside the viewport', () => {
    expect(fitZoom(1280, 800, 768, 544)).toBeCloseTo(Math.min((1280 - 24) / 768, (800 - 24) / 544), 5);
    expect(fitZoom(0, 800, 768, 544)).toBe(1);
  });
});

describe('url flags', () => {
  it('reads demo and mode from the query string', () => {
    expect(isDemo('?demo=1')).toBe(true);
    expect(isDemo('?demo=0')).toBe(false);
    expect(parseInitialMode('?mode=god')).toBe('god');
    expect(parseInitialMode('')).toBe('avatar');
  });
});
