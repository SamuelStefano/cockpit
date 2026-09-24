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
