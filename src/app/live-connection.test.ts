import { describe, it, expect } from 'vitest';
import { shouldReconnect, STALE_HIDDEN_MS } from './live-connection';

describe('shouldReconnect', () => {
  it('reconecta quando o socket não está conectado, mesmo recém-escondido', () => {
    expect(shouldReconnect(0, 'down')).toBe(true);
    expect(shouldReconnect(0, 'reconnecting')).toBe(true);
  });

  it('não reconecta quando conectado e escondido por pouco tempo', () => {
    expect(shouldReconnect(0, 'connected')).toBe(false);
    expect(shouldReconnect(STALE_HIDDEN_MS, 'connected')).toBe(false);
  });

  it('reconecta quando conectado mas escondido tempo demais (estado durável envelheceu)', () => {
    expect(shouldReconnect(STALE_HIDDEN_MS + 1, 'connected')).toBe(true);
    expect(shouldReconnect(60_000, 'connected')).toBe(true);
  });
});
