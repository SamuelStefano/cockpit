export const APP_ORIGIN = 'https://deck.devfellowship.com';

// /sandbox/ runs untrusted previews inside frames; as a top-level page it would hold
// the app origin in the main frame, which is what the bridge trusts.
const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

// nginx decodes and merges slashes before matching, so the raw path can hide it.
function isSandboxPath(pathname: string): boolean {
  try {
    return decodeURIComponent(pathname).replace(/\/+/g, '/').startsWith('/sandbox');
  } catch {
    return true;
  }
}

export type LinkAction = 'app' | 'external' | 'blocked';

// The OS treats file:, smb: and ms-msdt: links as actions, and link text can come
// from model output, so anything outside this short list is dropped.
export function classifyLink(raw: string): LinkAction {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'blocked';
  }
  if (url.origin === APP_ORIGIN) return isSandboxPath(url.pathname) ? 'blocked' : 'app';
  return EXTERNAL_SCHEMES.has(url.protocol) ? 'external' : 'blocked';
}

const GRANTED_PERMISSIONS = new Set(['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write']);

export function canGrantPermission(permission: string, origin: string, isMainFrame: boolean): boolean {
  return isMainFrame && origin === APP_ORIGIN && GRANTED_PERMISSIONS.has(permission);
}
