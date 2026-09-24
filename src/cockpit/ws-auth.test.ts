import { describe, it, expect } from 'vitest';
import { onAuthClose, tokenUnchangedAndLive, shouldRefreshSession, dialOnTokenChange } from './ws-auth';

describe('onAuthClose', () => {
  it('shows the token gate on loopback and retries on the relay', () => {
    expect(onAuthClose(false)).toBe('token-gate');
    expect(onAuthClose(true)).toBe('refresh-and-retry');
  });
});

describe('tokenUnchangedAndLive', () => {
  it('skips only when the token is the same and the socket is connecting or open', () => {
    expect(tokenUnchangedAndLive('t', 't', 0)).toBe(true);
    expect(tokenUnchangedAndLive('t', 't', 1)).toBe(true);
  });

  it('reconnects after a close, even with the same token', () => {
    expect(tokenUnchangedAndLive('t', 't', 3)).toBe(false);
    expect(tokenUnchangedAndLive('t', 't', undefined)).toBe(false);
    expect(tokenUnchangedAndLive('u', 't', 1)).toBe(false);
  });
});

describe('4401 backoff helpers', () => {
  it('refreshes the session at most every 5 minutes', () => {
    expect(shouldRefreshSession(0, 10 * 60_000)).toBe(true);
    expect(shouldRefreshSession(10 * 60_000, 12 * 60_000)).toBe(false);
  });

  it('a token that arrives during the backoff does not dial at once', () => {
    expect(dialOnTokenChange(30_000, 1_000)).toBe(false);
    expect(dialOnTokenChange(30_000, 30_000)).toBe(true);
    expect(dialOnTokenChange(0, 5)).toBe(true);
  });
});
