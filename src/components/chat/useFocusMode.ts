import { useEffect, useState } from 'react';

const COMPOSER_SELECTOR = 'textarea[aria-label="Escrever mensagem"]';

// Phone focus mode: while the keyboard is open for the composer, everything except the
// thread and the composer box steps aside. It follows the keyboard, not the draft: keyed
// on the first typed letter, the layout jumped mid-typing. Other fields (rename, model
// search) stay out, since collapsing the header would hide the field being edited.
export function isFocusMode(isMobile: boolean, keyboardOpen: boolean, composerFocused: boolean): boolean {
  return isMobile && keyboardOpen && composerFocused;
}

function composerHasFocus(): boolean {
  return document.activeElement?.matches(COMPOSER_SELECTOR) ?? false;
}

export function useFocusMode(isMobile: boolean, keyboardOpen: boolean): boolean {
  const [composerFocused, setComposerFocused] = useState(composerHasFocus);
  useEffect(() => {
    const apply = () => setComposerFocused(composerHasFocus());
    apply();
    document.addEventListener('focusin', apply);
    document.addEventListener('focusout', apply);
    return () => {
      document.removeEventListener('focusin', apply);
      document.removeEventListener('focusout', apply);
    };
  }, []);
  return isFocusMode(isMobile, keyboardOpen, composerFocused);
}

// Tapping the thread while typing dismisses the keyboard (which also exits focus mode).
export function blurActiveEditable(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement || el.isContentEditable)) el.blur();
}
