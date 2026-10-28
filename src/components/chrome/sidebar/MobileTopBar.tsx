import type { ReactNode } from 'react';
import { IconButton } from '../../primitives';

interface MobileTopBarProps {
  onMenu: () => void;
  menuOpen: boolean;
  title: string;
  action?: ReactNode;
  slotRef?: (el: HTMLElement | null) => void;
}

// Phone bar for the pages outside the chat: ☰ · title · one optional action. The
// plan ring and the avatar live in the drawer's footer, not here.
export function MobileTopBar({ onMenu, menuOpen, title, action, slotRef }: MobileTopBarProps) {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-1 bg-neutral-950 px-2">
      <IconButton icon="menu" label="Menu" side="bottom" aria-expanded={menuOpen} onClick={onMenu} className="pointer-coarse:h-11 pointer-coarse:w-11" />
      <span className="min-w-0 flex-1 truncate font-display text-[20px] font-bold text-neutral-50">{title}</span>
      <div ref={slotRef} className="flex shrink-0 items-center gap-0.5" />
      {action}
    </header>
  );
}
