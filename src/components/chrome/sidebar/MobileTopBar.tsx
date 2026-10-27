import { IconButton, type ConnState } from '../../primitives';
import { ProfileMenu } from '../../ProfileMenu';
import type { NavRole } from '../nav-routes';
import type { AccountProps } from './SidebarFooter';
import { UsageDock, type UsageDockProps } from './UsageDock';

interface MobileTopBarProps {
  onMenu: () => void;
  menuOpen: boolean;
  usage: UsageDockProps;
  account: AccountProps;
  conn: ConnState;
  role: NavRole;
}

// Phone shell: nothing but the menu, a fixed title and the two dock icons. The
// title is deliberately not the conversation's (that lives in the chat header).
export function MobileTopBar({ onMenu, menuOpen, usage, account, conn, role }: MobileTopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-2">
      <IconButton icon="menu" label="Menu" side="bottom" aria-expanded={menuOpen} onClick={onMenu} className="pointer-coarse:h-11 pointer-coarse:w-11" />
      <span className="flex-1 font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">Deck</span>
      <UsageDock {...usage} mobile />
      <ProfileMenu {...account} conn={conn} role={role} />
    </header>
  );
}
