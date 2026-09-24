import { useEffect, useRef } from 'react';

// A role="menu" is expected to take focus on open and move with the arrows
// (WAI-ARIA menu pattern). Items are found by role, so the menu markup stays
// plain buttons.
export function useMenuKeys<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);

  useEffect(() => {
    if (open) items()[0]?.focus();
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
