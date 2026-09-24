// What a 4401 close means depends on the mode. Loopback: the token is wrong,
// show the token gate and stop. Relay: there is no token gate, and the relay
// answers 4401 whenever it fails to resolve the identity (a JWKS or PostgREST
// hiccup), so refresh the session and retry later instead of sitting stuck.
export type AuthCloseAction = 'token-gate' | 'refresh-and-retry';

export function onAuthClose(relayMode: boolean): AuthCloseAction {
  return relayMode ? 'refresh-and-retry' : 'token-gate';
}

// Retry after a relay 4401: long enough not to hammer the relay.
export const RELAY_AUTH_RETRY_MS = 30_000;

// submitToken may skip reconnecting only when the token is unchanged AND the
// socket is still OPEN or CONNECTING. A CLOSED one (after a 4401) must reconnect,
// or a refresh that hands back the same JWT would leave the tab stuck.
export function tokenUnchangedAndLive(next: string, current: string, readyState: number | undefined): boolean {
  return next === current && readyState !== undefined && readyState <= 1;
}
