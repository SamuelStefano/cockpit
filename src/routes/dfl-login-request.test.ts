// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DFL_LOGIN_EVENT, requestDflLogin, takeDflLogin } from './dfl-login-request';

describe('dfl login request', () => {
  it('parks the host once and announces it', () => {
    const seen = vi.fn();
    window.addEventListener(DFL_LOGIN_EVENT, seen);
    requestDflLogin('work');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(takeDflLogin()).toBe('work');
    expect(takeDflLogin()).toBeNull();
    window.removeEventListener(DFL_LOGIN_EVENT, seen);
  });
});
