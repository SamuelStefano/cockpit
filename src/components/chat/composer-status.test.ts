import { describe, expect, it } from 'vitest';
import { composerStatus } from './composer-status';
import { contextMeter } from './toolbar-format';

describe('composerStatus', () => {
  it('is null with neither context data nor queue', () => {
    expect(composerStatus(0, null, 0)).toBeNull();
  });

  it('keeps the queue when there is no context data', () => {
    expect(composerStatus(0, null, 2)).toEqual({ context: null, queued: 2 });
  });

  it('maps the context meter to ok, warn and err tones', () => {
    const at = (pct: number) => {
      for (let k = 1; k < 2000; k++) {
        const m = contextMeter(k * 1000, null);
        if (m && m.pct >= pct) return k * 1000;
      }
      return 2_000_000;
    };
    expect(composerStatus(at(10), null, 0)?.context?.tone).toBe('ok');
    expect(composerStatus(at(55), null, 0)?.context?.tone).toBe('warn');
    expect(composerStatus(at(80), null, 0)?.context?.tone).toBe('err');
  });
});
