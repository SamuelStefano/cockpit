import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A dialog that declares aria-modal must also behave like one for keyboard and
// screen-reader users: move focus in when it opens (to `[data-autofocus]` or the
// first focusable), keep Tab inside it, and give focus back to whatever had it
// when it closes. Without this, Tab walked the page behind the dialog.
// `opener` is what had focus before the dialog rendered: content with autoFocus
// takes focus during commit, before this effect can see who had it.
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open = true, opener?: RefObject<Element | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const before = opener?.current ?? document.activeElement;
    const previous = before instanceof HTMLElement && !root.contains(before) ? before : null;
    const items = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    // Content that focused itself on mount (an input with autoFocus) keeps it.
    if (!root.contains(document.activeElement)) (root.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0] ?? root).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [ref, open]);
}
