import { describe, it, expect, vi } from 'vitest';

vi.mock('../engine/claude', () => ({ minimalEnv: () => ({}) }));
vi.mock('./incidents', () => ({ recordIncident: () => {} }));

const { isAuthFailure, authHoldFrom, refreshDue, REFRESH_LEAD_MS } = await import('./auth-health');

describe('isAuthFailure', () => {
  it('matches the CLI bailout line', () => {
    expect(isAuthFailure('Failed to authenticate: OAuth session expired and could not be refreshed')).toBe(true);
    expect(isAuthFailure('claude saiu (1): API Error: 401 {"type":"error","error":{"type":"authentication_error"}}')).toBe(true);
  });

  it('ignores empty text and long answers that merely discuss auth', () => {
    expect(isAuthFailure('')).toBe(false);
    expect(isAuthFailure(`Here is how OAuth session expired errors happen. ${'x'.repeat(500)}`)).toBe(false);
    expect(isAuthFailure('Tudo certo, PR mergeada.')).toBe(false);
  });
});

describe('authHoldFrom', () => {
  it('holds while credentials were not rewritten after the failure', () => {
    expect(authHoldFrom(0, 100)).toBe(false);
    expect(authHoldFrom(200, 100)).toBe(true);
    expect(authHoldFrom(200, 200)).toBe(true);
  });

  it('releases once a new login rewrites the credentials', () => {
    expect(authHoldFrom(200, 201)).toBe(false);
  });
});

describe('refreshDue', () => {
  const now = 1_000_000_000;
  it('is due inside the lead window and after expiry', () => {
    expect(refreshDue(now + REFRESH_LEAD_MS - 1, now)).toBe(true);
    expect(refreshDue(now - 1, now)).toBe(true);
  });

  it('is not due with plenty of time left or without a login', () => {
    expect(refreshDue(now + REFRESH_LEAD_MS + 60_000, now)).toBe(false);
    expect(refreshDue(0, now)).toBe(false);
  });
});
