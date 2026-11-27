import { describe, expect, it } from 'vitest';
import { secretFrameAllowed } from './secret-gate';

describe('secretFrameAllowed', () => {
  it('accepts secret frames on sealed and local transports', () => {
    for (const t of ['vault-put', 'byo-key-set']) {
      expect(secretFrameAllowed(t, 'sealed')).toBe(true);
      expect(secretFrameAllowed(t, 'local')).toBe(true);
    }
  });
  it('rejects secret frames on a plaintext transport', () => {
    expect(secretFrameAllowed('vault-put', 'plain')).toBe(false);
    expect(secretFrameAllowed('byo-key-set', 'plain')).toBe(false);
  });
  it('does not gate other frames', () => {
    expect(secretFrameAllowed('vault-list', 'plain')).toBe(true);
    expect(secretFrameAllowed('byo-keys-get', 'plain')).toBe(true);
  });
});
