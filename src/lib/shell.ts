// The App Store build wraps the web app in a native WebView that injects
// window.ReactNativeWebView. This is the ONE place that tells the two apart; every
// shell-only difference asks here, and outside the shell nothing changes.
interface ShellGlobal { ReactNativeWebView?: { postMessage?: (data: string) => void } }

export function inShell(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as ShellGlobal).ReactNativeWebView;
}

// What the web side may ask the native shell to do.
export type ShellMessage =
  | { type: 'notify'; kind: 'turn-done' | 'turn-error'; title: string; body: string; tag: string }
  | { type: 'share'; message: string }
  | { type: 'haptic'; style: 'light' | 'medium' | 'success' | 'error' }
  | { type: 'screenshots-enable' }
  | { type: 'screenshots-disable' }
  | { type: 'screenshot-accept'; id: string };

// Must match BRIDGE_VERSION in apps/ios/src/bridge.ts: the shell drops any other version.
const BRIDGE_VERSION = 1;

export function postToShell(msg: ShellMessage): boolean {
  if (!inShell()) return false;
  try {
    (window as unknown as ShellGlobal).ReactNativeWebView!.postMessage?.(JSON.stringify({ v: BRIDGE_VERSION, ...msg }));
    return true;
  } catch {
    return false;
  }
}

// What the native shell tells the web: a `deck-shell` CustomEvent on window (injected by the shell).
// Must match apps/ios/src/shellEvents.ts. The page cannot trust the detail blindly: anything on the
// page can dispatch the same event, so it is validated strictly here.
export type ShellAccess = 'granted' | 'limited' | 'denied' | 'undetermined';
export type ShellEvent =
  | { type: 'screenshots-status'; status: ShellAccess }
  | { type: 'screenshot-available'; id: string; thumbnail: string }
  | { type: 'screenshot-data'; id: string; dataUrl: string };

const SHELL_EVENT = 'deck-shell';
const SCREENSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9/_.:-]{0,199}$/;
const JPEG_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
export const MAX_THUMBNAIL_CHARS = 200_000;
export const MAX_SCREENSHOT_CHARS = 8_000_000;
const ACCESS: readonly string[] = ['granted', 'limited', 'denied', 'undetermined'];

export function parseShellEvent(detail: unknown): ShellEvent | null {
  if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) return null;
  const d = detail as Record<string, unknown>;
  const idOk = typeof d.id === 'string' && SCREENSHOT_ID.test(d.id);
  switch (d.type) {
    case 'screenshots-status':
      return typeof d.status === 'string' && ACCESS.includes(d.status) ? { type: 'screenshots-status', status: d.status as ShellAccess } : null;
    case 'screenshot-available':
      return idOk && typeof d.thumbnail === 'string' && d.thumbnail.length <= MAX_THUMBNAIL_CHARS && JPEG_DATA_URL.test(d.thumbnail)
        ? { type: 'screenshot-available', id: d.id as string, thumbnail: d.thumbnail }
        : null;
    case 'screenshot-data':
      return idOk && typeof d.dataUrl === 'string' && d.dataUrl.length <= MAX_SCREENSHOT_CHARS && JPEG_DATA_URL.test(d.dataUrl)
        ? { type: 'screenshot-data', id: d.id as string, dataUrl: d.dataUrl }
        : null;
    default:
      return null;
  }
}

/** Listens for shell events. A browser has no shell: nothing is attached and the cleanup is a no-op. */
export function onShellEvent(cb: (e: ShellEvent) => void): () => void {
  if (!inShell()) return () => {};
  const handler = (ev: Event) => {
    const parsed = parseShellEvent((ev as CustomEvent).detail);
    if (parsed) cb(parsed);
  };
  window.addEventListener(SHELL_EVENT, handler);
  return () => window.removeEventListener(SHELL_EVENT, handler);
}

/** A JPEG data URL as a File, or null when it is not one. */
export function dataUrlToFile(dataUrl: string, name: string): File | null {
  if (!JPEG_DATA_URL.test(dataUrl)) return null;
  try {
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

// The automatic-screenshots opt-in is per device (plain localStorage, never synced): it is what lets
// the shell ask iOS for Photos access, so another device's choice must not carry over.
const OPT_IN_KEY = 'deckScreenshotsOptIn';
const OPT_IN_DISMISSED_KEY = 'deckScreenshotsOptInDismissed';
const flag = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const setFlag = (k: string, on: boolean) => { try { if (on) localStorage.setItem(k, '1'); else localStorage.removeItem(k); } catch { /* storage blocked */ } };
export const screenshotsOptedIn = () => flag(OPT_IN_KEY);
export const setScreenshotsOptedIn = (on: boolean) => setFlag(OPT_IN_KEY, on);
export const screenshotsPromptDismissed = () => flag(OPT_IN_DISMISSED_KEY);
export const setScreenshotsPromptDismissed = (on: boolean) => setFlag(OPT_IN_DISMISSED_KEY, on);
