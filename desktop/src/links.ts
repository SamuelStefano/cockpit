export const APP_ORIGIN = 'https://deck.devfellowship.com';

const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

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
  if (url.origin === APP_ORIGIN) return 'app';
  return EXTERNAL_SCHEMES.has(url.protocol) ? 'external' : 'blocked';
}

const GRANTED_PERMISSIONS = new Set(['media', 'notifications', 'clipboard-sanitized-write']);

export function canGrantPermission(permission: string, origin: string, isMainFrame: boolean): boolean {
  return isMainFrame && origin === APP_ORIGIN && GRANTED_PERMISSIONS.has(permission);
}
