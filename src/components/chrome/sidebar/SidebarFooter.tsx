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

// The account line: avatar + name, and the plan ring at the far end. In the rail
// the same two controls stack as icons.
export function SidebarFooter({ expanded, usage, account, conn, role }: SidebarFooterProps) {
  return (
    <div className={`flex shrink-0 items-center px-2 pb-2 pt-1 ${expanded ? 'flex-row gap-1' : 'flex-col gap-1'}`}>
      <div className={expanded ? 'min-w-0 flex-1' : ''}>
        <ProfileMenu {...account} conn={conn} role={role} placement="up-start" variant={expanded ? 'row' : 'rail'} />
      </div>
      <UsageDock {...usage} />
    </div>
  );
}
