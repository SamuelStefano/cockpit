import { describe, it, expect } from 'vitest';
import { capsFor } from './auth';

describe('capsFor', () => {
  it('canBypass only for admin with flag on a local-only deploy', () => {
    expect(capsFor('admin', { allowBypass: true, localOnly: true })).toEqual({ role: 'admin', canBypass: true });
    expect(capsFor('admin', { allowBypass: false, localOnly: true }).canBypass).toBe(false);
    expect(capsFor('admin', { allowBypass: true, localOnly: false }).canBypass).toBe(false);
    expect(capsFor('student', { allowBypass: true, localOnly: true }).canBypass).toBe(false);
  });

  it('announces root for the owner connection, never for a student engine', () => {
    expect(capsFor('admin', { allowBypass: true, localOnly: true }, true)).toEqual({ role: 'root', canBypass: true });
    expect(capsFor('student', { allowBypass: true, localOnly: true }, true).role).toBe('student');
    expect(capsFor('admin', { allowBypass: false, localOnly: true }).role).toBe('admin');
  });
});
