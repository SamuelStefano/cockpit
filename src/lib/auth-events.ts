// The relay closes a browser socket with 4001 when its JWT expires. A visible tab
// has usually refreshed the token already (supabase-js refreshes ~90 s before);
// a hidden one hasn't (auto-refresh pauses in the background), and redialing with
// the stale token would hit 4401 and the login gate. The socket layer asks the
// auth layer for a fresh token through this event.
export const TOKEN_EXPIRED_EVENT = 'deck:token-expired';
export const TOKEN_EXPIRED_CLOSE = 4001;
