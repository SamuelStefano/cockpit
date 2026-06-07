import { describe, it, expect } from 'vitest';
import { roleFromIdentity, parseRootEmails, canGrantAdmin, canSeeAllAccounts } from './identity';

describe('roleFromIdentity', () => {
  const roots = parseRootEmails('samuel@dfl.com, boss@dfl.com');

  it('returns root for an email in the allowlist (case/space-insensitive)', () => {
    expect(roleFromIdentity('  Samuel@DFL.com ', false, roots)).toBe('root');
  });

  it('root beats the admin flag', () => {
    expect(roleFromIdentity('samuel@dfl.com', false, roots)).toBe('root');
  });

  it('returns admin when the is_admin flag is set and not root', () => {
    expect(roleFromIdentity('alice@dfl.com', true, roots)).toBe('admin');
  });

  it('returns fellow by default', () => {
    expect(roleFromIdentity('bob@dfl.com', false, roots)).toBe('fellow');
  });

  it('fails closed to fellow when the email is missing (identity failure)', () => {
    expect(roleFromIdentity(null, true, roots)).toBe('fellow');
    expect(roleFromIdentity(undefined, true, roots)).toBe('fellow');
    expect(roleFromIdentity('', true, roots)).toBe('fellow');
  });

  it('never mints root from the is_admin flag — only the env allowlist does', () => {
    // is_admin can elevate to admin, but NEVER to root, even with no allowlist.
    expect(roleFromIdentity('intruder@evil.com', true, roots)).toBe('admin');
    expect(roleFromIdentity('intruder@evil.com', true, new Set())).toBe('admin');
    expect(roleFromIdentity('intruder@evil.com', true, roots)).not.toBe('root');
  });
});

describe('parseRootEmails', () => {
  it('splits, trims and lowercases', () => {
    const s = parseRootEmails(' A@x.com , B@Y.com ');
    expect(s.has('a@x.com')).toBe(true);
    expect(s.has('b@y.com')).toBe(true);
  });

  it('returns an empty set for undefined/blank (no root)', () => {
    expect(parseRootEmails(undefined).size).toBe(0);
    expect(parseRootEmails('   ').size).toBe(0);
    expect(parseRootEmails(',, ,').size).toBe(0);
  });
});

describe('account authorization helpers', () => {
  it('only root can grant admin', () => {
    expect(canGrantAdmin('root')).toBe(true);
    expect(canGrantAdmin('admin')).toBe(false);
    expect(canGrantAdmin('fellow')).toBe(false);
  });

  it('root and admin see all accounts; fellow does not', () => {
    expect(canSeeAllAccounts('root')).toBe(true);
    expect(canSeeAllAccounts('admin')).toBe(true);
    expect(canSeeAllAccounts('fellow')).toBe(false);
  });
});
