// Phone focus mode: once the keyboard is open and the draft has text, everything
// except the thread and the composer box steps aside. Pure so it is trivial to test.
export function isFocusMode(isMobile: boolean, keyboardOpen: boolean, draft: string): boolean {
  return isMobile && keyboardOpen && draft.trim().length > 0;
}

export function useFocusMode(isMobile: boolean, keyboardOpen: boolean, draft: string): boolean {
  return isFocusMode(isMobile, keyboardOpen, draft);
}

// Tapping the thread while typing dismisses the keyboard (which also exits focus mode).
export function blurActiveEditable(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement || el.isContentEditable)) el.blur();
}
