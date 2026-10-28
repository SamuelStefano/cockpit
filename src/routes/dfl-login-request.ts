export const DFL_LOGIN_EVENT = 'deck:dfl-mcp-login';

let pending: string | null = null;

// The login terminal lives in a collapsed panel that may not be mounted yet, so
// the request is parked until the panel takes it.
export function requestDflLogin(host: string): void {
  pending = host;
  window.dispatchEvent(new CustomEvent(DFL_LOGIN_EVENT, { detail: host }));
}

export function takeDflLogin(): string | null {
  const host = pending;
  pending = null;
  return host;
}
