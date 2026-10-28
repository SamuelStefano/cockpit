export const MCP_LOGIN_EVENT = 'deck:mcp-login';

let pending: string | null = null;

// The login terminal lives in a collapsed panel that may not be mounted yet, so
// the request is parked until the panel takes it.
export function requestMcpLogin(name: string): void {
  pending = name;
  window.dispatchEvent(new CustomEvent(MCP_LOGIN_EVENT, { detail: name }));
}

export function takeMcpLogin(): string | null {
  const name = pending;
  pending = null;
  return name;
}
