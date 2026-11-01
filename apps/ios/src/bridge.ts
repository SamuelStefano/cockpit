/**
 * The bridge between the web document and the shell: one message channel, WebView `postMessage`.
 *
 * The web calls `window.ReactNativeWebView.postMessage(JSON.stringify(msg))`. The shell parses the
 * string here (pure, strict) and runs the handler (`bridgeHandlers.ts`). Anything that does not
 * parse is dropped silently: the page is untrusted input.
 *
 * Messages (version 1):
 *   { v: 1, type: 'notify', title, body }        local notification (expo-notifications)
 *   { v: 1, type: 'share',  message?, url? }     iOS share sheet
 *   { v: 1, type: 'haptic', style }              haptic feedback
 *   { v: 1, type: 'screenshots-enable' }         the user opted in to the screenshot offer (Photos are read only after this)
 *   { v: 1, type: 'screenshots-disable' }        the user turned it off
 *   { v: 1, type: 'screenshot-accept', id }      the user accepted the offered screenshot: send it back
 *
 * Pure TypeScript: no React Native import.
 */
import { originOf } from './origin';

export const BRIDGE_VERSION = 1;
export const MAX_RAW_BYTES = 8 * 1024;
export const MAX_TITLE = 120;
export const MAX_BODY = 300;
export const MAX_SHARE_MESSAGE = 2000;
export const HAPTIC_STYLES = ['light', 'medium', 'heavy', 'rigid', 'soft', 'success', 'warning', 'error', 'selection'] as const;
export type HapticStyle = (typeof HAPTIC_STYLES)[number];

export type BridgeMessage =
  | { type: 'notify'; title: string; body: string }
  | { type: 'share'; message?: string; url?: string }
  | { type: 'haptic'; style: HapticStyle }
  | { type: 'screenshots-enable' }
  | { type: 'screenshots-disable' }
  | { type: 'screenshot-accept'; id: string };

/** A Photos local identifier ("UUID/L0/001"): short, printable, no spaces. */
export const SCREENSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9/_.:-]{0,199}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A string within a limit, or null. Control characters (but not newline) make it invalid. */
function text(v: unknown, max: number, required: boolean): string | null | undefined {
  if (v === undefined) return required ? null : undefined;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (required && !t) return null;
  // eslint-disable-next-line no-control-regex
  if ([...t].length > max || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(t)) return null;
  return t;
}

/** An https URL, or null. */
function httpsUrl(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.length > 2048) return null;
  try {
    return new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

/** Parse the raw `event.nativeEvent.data` string. Returns null for anything that is not a valid message. */
export function parseBridgeMessage(raw: unknown): BridgeMessage | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_RAW_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.v !== BRIDGE_VERSION) return null;
  switch (data.type) {
    case 'notify': {
      const title = text(data.title, MAX_TITLE, true);
      const body = text(data.body, MAX_BODY, false);
      return title && body !== null ? { type: 'notify', title, body: body ?? '' } : null;
    }
    case 'share': {
      const message = text(data.message, MAX_SHARE_MESSAGE, false);
      const url = httpsUrl(data.url);
      if (message === null || url === null) return null;
      if (message === undefined && url === undefined) return null;
      return { type: 'share', ...(message ? { message } : {}), ...(url ? { url } : {}) };
    }
    case 'haptic':
      return typeof data.style === 'string' && (HAPTIC_STYLES as readonly string[]).includes(data.style)
        ? { type: 'haptic', style: data.style as HapticStyle }
        : null;
    case 'screenshots-enable':
      return { type: 'screenshots-enable' };
    case 'screenshots-disable':
      return { type: 'screenshots-disable' };
    case 'screenshot-accept':
      return typeof data.id === 'string' && SCREENSHOT_ID.test(data.id) ? { type: 'screenshot-accept', id: data.id } : null;
    default:
      return null;
  }
}

/** The message came from the top frame of the app origin (the page URL the WebView reports). */
export function isTrustedSender(pageUrl: string | undefined, appOrigin: string): boolean {
  if (!pageUrl) return false;
  const o = originOf(pageUrl);
  return o !== null && o === originOf(appOrigin);
}
