import { describe, expect, it } from 'vitest';
import { secretFrameAllowed } from './secret-gate';

describe('secretFrameAllowed', () => {
  it('accepts vault-put on sealed and local transports', () => {
    expect(secretFrameAllowed('vault-put', 'sealed')).toBe(true);
    expect(secretFrameAllowed('vault-put', 'local')).toBe(true);
  });
  it('rejects vault-put on a plaintext transport', () => {
    expect(secretFrameAllowed('vault-put', 'plain')).toBe(false);
  });
  it('does not gate other frames', () => {
    expect(secretFrameAllowed('vault-list', 'plain')).toBe(true);
  });
});
