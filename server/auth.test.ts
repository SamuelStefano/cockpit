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
  it('canBypass only for admin with flag on loopback', () => {
    expect(capsFor('admin', { allowBypass: true, host: '127.0.0.1' })).toEqual({ role: 'admin', canBypass: true });
    expect(capsFor('admin', { allowBypass: false, host: '127.0.0.1' }).canBypass).toBe(false);
    expect(capsFor('admin', { allowBypass: true, host: '0.0.0.0' }).canBypass).toBe(false);
    expect(capsFor('student', { allowBypass: true, host: '127.0.0.1' }).canBypass).toBe(false);
  });
});
