// Shortcut labels follow the keyboard in front of the user: "⌘K" on a Mac or an
// iPad, "Ctrl K" elsewhere. The handlers already accept both modifiers.
export function isApple(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Mac|iPhone|iPad|iPod/.test(ua);
}

export function keyLabel(k: string, apple = isApple()): string {
  if (apple) return k;
  if (k === '⌘') return 'Ctrl';
  if (k === '⌥') return 'Alt';
  return k;
}

// "⌘K" / "Ctrl+K" for inline text (titles, placeholders).
export function comboLabel(keys: string[], apple = isApple()): string {
  return apple ? keys.join('') : keys.map((k) => keyLabel(k, false)).join('+');
}

// Installed PWA (home-screen launch): the only iOS context where Notification exists.
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// iPhone/iPad, including iPadOS reporting itself as a Mac (touch + Macintosh).
export function isIOS(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent, touchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints ?? 0): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}
