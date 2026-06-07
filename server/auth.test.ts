import { describe, it, expect } from 'vitest';
import { currentRole, roleFromToken, capsFor } from './auth';

describe('roleFromToken', () => {
  it('matching token → admin (single-account seam)', () => {
    expect(roleFromToken('s3cret', 's3cret')).toBe('admin');
  });
  it('wrong or missing token → student', () => {
    expect(roleFromToken('s3cret', 'nope')).toBe('student');
    expect(roleFromToken('s3cret', null)).toBe('student');
  });
  it('empty expected never grants admin (no token configured)', () => {
    expect(roleFromToken('', '')).toBe('student');
    expect(roleFromToken('', null)).toBe('student');
  });
});

describe('currentRole', () => {
  it('is admin in loopback single-user', () => {
    expect(currentRole()).toBe('admin');
  });
});

describe('capsFor', () => {
  it('canBypass only for admin with flag on a local-only deploy', () => {
    expect(capsFor('admin', { allowBypass: true, localOnly: true })).toEqual({ role: 'admin', canBypass: true });
    expect(capsFor('admin', { allowBypass: false, localOnly: true }).canBypass).toBe(false);
    expect(capsFor('admin', { allowBypass: true, localOnly: false }).canBypass).toBe(false);
    expect(capsFor('student', { allowBypass: true, localOnly: true }).canBypass).toBe(false);
  });
});
