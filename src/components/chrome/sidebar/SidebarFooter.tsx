import { ProfileMenu } from '../../ProfileMenu';
import type { ConnState } from '../../primitives';
import type { NavRole } from '../nav-routes';
import type { DropApi } from '../../../cockpit/useDrops';
import { UsageDock, type UsageDockProps } from './UsageDock';

export interface AccountProps {
  userId?: string;
  onSignOut?: () => void;
  onChangePassword?: (password: string) => Promise<string | null>;
  drops?: DropApi;
}

interface SidebarFooterProps {
  expanded: boolean;
  usage: UsageDockProps;
  account: AccountProps;
  conn: ConnState;
  role: NavRole;
}

export function SidebarFooter({ expanded, usage, account, conn, role }: SidebarFooterProps) {
  return (
    <div className={`flex shrink-0 items-center border-t border-neutral-800 p-2 ${expanded ? 'flex-row justify-between' : 'flex-col gap-1.5'}`}>
      <div className={expanded ? 'pl-1' : ''}>
        <ProfileMenu {...account} conn={conn} role={role} placement="up-start" />
      </div>
      <UsageDock {...usage} />
    </div>
  );
}
