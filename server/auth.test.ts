import { describe, it, expect } from 'vitest';
import { capsFor } from './auth';

describe('capsFor', () => {
  it('canBypass only for admin with flag on a local-only deploy', () => {
    expect(capsFor('admin', { allowBypass: true, localOnly: true })).toEqual({ role: 'admin', canBypass: true });
    expect(capsFor('admin', { allowBypass: false, localOnly: true }).canBypass).toBe(false);
    expect(capsFor('admin', { allowBypass: true, localOnly: false }).canBypass).toBe(false);
    expect(capsFor('student', { allowBypass: true, localOnly: true }).canBypass).toBe(false);
  });
});
