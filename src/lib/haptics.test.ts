import { describe, it, expect, vi, afterEach } from 'vitest';
import { haptic } from './haptics';
import { savePref } from './persist';
import { HAPTICS_KEY } from './prefs';

afterEach(() => { vi.unstubAllGlobals(); });

function stub(coarse: boolean) {
  const vibrate = vi.fn();
  vi.stubGlobal('navigator', { vibrate });
  vi.stubGlobal('matchMedia', () => ({ matches: coarse }));
  return vibrate;
}

describe('haptic', () => {
  it('vibrates on touch devices by default', () => {
    const vibrate = stub(true);
    haptic('tap');
    expect(vibrate).toHaveBeenCalledWith([10]);
  });
  it('stays silent with a fine pointer', () => {
    const vibrate = stub(false);
    haptic('done');
    expect(vibrate).not.toHaveBeenCalled();
  });
  it('respects the preference', () => {
    const store: Record<string, string> = { ['cockpit:' + HAPTICS_KEY]: 'false' };
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: () => {} });
    const vibrate = stub(true);
    haptic('error');
    expect(vibrate).not.toHaveBeenCalled();
    void savePref;
  });
});
