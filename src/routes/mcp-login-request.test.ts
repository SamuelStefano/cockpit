// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MCP_LOGIN_EVENT, requestMcpLogin, takeMcpLogin } from './mcp-login-request';

describe('mcp login request', () => {
  it('parks the name once and announces it', () => {
    const seen = vi.fn();
    window.addEventListener(MCP_LOGIN_EVENT, seen);
    requestMcpLogin('github');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(takeMcpLogin()).toBe('github');
    expect(takeMcpLogin()).toBeNull();
    window.removeEventListener(MCP_LOGIN_EVENT, seen);
  });
});
