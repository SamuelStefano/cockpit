import { ProfileMenu } from '../../ProfileMenu';
import { IconButton, type ConnState } from '../../primitives';
import type { NavItem, NavRole } from '../nav-routes';
import type { Route } from '../../../useRoute';
import type { DropApi } from '../../../cockpit/useDrops';
import { ArcadeButton } from '../../game/ArcadeButton';

export interface AccountProps {
  userId?: string;
  onSignOut?: () => void;
  onChangePassword?: (password: string) => Promise<string | null>;
  drops?: DropApi;
}

interface SidebarFooterProps {
  routes: NavItem[];
  route: Route;
  nav: (to: Route) => void;
  counts?: Partial<Record<Route, number>>;
  expanded: boolean;
  onSettings?: () => void;
  account: AccountProps;
  conn: ConnState;
  role: NavRole;
}

// The account line: avatar + name (the account menu with devices), and the
// settings gear at the far end. In the rail the same two controls stack.
export function SidebarFooter({ routes, route, nav, counts, expanded, onSettings, account, conn, role }: SidebarFooterProps) {
  return (
    <div className={`flex shrink-0 items-center border-t border-neutral-800/80 px-2 pb-2 pt-2 ${expanded ? 'flex-row gap-1' : 'flex-col gap-1'}`}>
      <div className={expanded ? 'min-w-0 flex-1' : ''}>
        <ProfileMenu {...account} conn={conn} role={role} placement="up-start" variant={expanded ? 'row' : 'rail'} routes={routes} route={route} nav={nav} counts={counts} />
      </div>
      <ArcadeButton expanded={expanded} onOpen={() => nav('/arcade')} />
      {onSettings && <IconButton icon="sliders" label="Configurações" side={expanded ? 'top' : 'right'} onClick={onSettings} />}
    </div>
  );
}
