import { ProfileMenu } from '../../ProfileMenu';
import { IconButton, type ConnState } from '../../primitives';
import type { NavRole } from '../nav-routes';
import type { DropApi } from '../../../cockpit/useDrops';

export interface AccountProps {
  userId?: string;
  onSignOut?: () => void;
  onChangePassword?: (password: string) => Promise<string | null>;
  drops?: DropApi;
}

interface SidebarFooterProps {
  expanded: boolean;
  onSettings?: () => void;
  account: AccountProps;
  conn: ConnState;
  role: NavRole;
  onDevices: () => void;
}

// The account line: avatar + name (the account menu with devices), and the
// settings gear at the far end. In the rail the same two controls stack.
export function SidebarFooter({ expanded, onSettings, account, conn, role, onDevices }: SidebarFooterProps) {
  return (
    <div className={`flex shrink-0 items-center border-t border-neutral-800/80 px-2 pb-2 pt-2 ${expanded ? 'flex-row gap-1' : 'flex-col gap-1'}`}>
      <div className={expanded ? 'min-w-0 flex-1' : ''}>
        <ProfileMenu {...account} conn={conn} role={role} placement="up-start" variant={expanded ? 'row' : 'rail'} onDevices={onDevices} onAccount={onSettings} />
      </div>
      {onSettings && <IconButton icon="sliders" label="Configurações" side={expanded ? 'top' : 'right'} onClick={onSettings} />}
    </div>
  );
}
