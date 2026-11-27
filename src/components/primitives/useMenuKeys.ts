import { useEffect, useRef, type RefObject } from 'react';

// A role="menu" is expected to take focus on open and move with the arrows
// (WAI-ARIA menu pattern). Items are found by role, so the menu markup stays
// plain buttons.
export function useMenuKeys<T extends HTMLElement>(open: boolean, trigger?: RefObject<HTMLElement | null>) {
  const ref = useRef<T>(null);
  const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) items()[0]?.focus();
    // Closing unmounts the focused item and focus fell to <body>: hand it back
    // to the trigger, unless the user already moved it somewhere real.
    else if (wasOpen.current && trigger?.current) {
      const a = document.activeElement;
      if (!a || a === document.body) trigger.current.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = items();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (i + 1) % list.length;
    else if (e.key === 'ArrowUp') next = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    if (next < 0) return;
    e.preventDefault();
    list[next].focus();
  };

  return { ref, onKeyDown };
}
