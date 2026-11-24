import { describe, expect, it } from 'vitest';
import { MIN_WIDTH, parseWindowState } from './window-state';

describe('parseWindowState', () => {
  it('falls back on missing or broken state', () => {
    expect(parseWindowState(null).width).toBe(1440);
    expect(parseWindowState('{bad').width).toBe(1440);
  });

  it('never restores below the desktop layout width', () => {
    expect(parseWindowState('{"width":500,"height":700}').width).toBe(MIN_WIDTH);
  });
});
