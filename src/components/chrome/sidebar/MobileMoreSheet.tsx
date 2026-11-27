import { BottomSheet } from '../../primitives/Sheet';
import { ProfileMenu } from '../../ProfileMenu';
import type { ConnState } from '../../primitives';
import type { Route } from '../../../useRoute';
import { canOpen } from '../rail/rail-order';
import type { NavRole } from '../nav-routes';
import { SidebarItem } from './SidebarItem';
import { sidebarNav } from './sidebar-nav';
import type { AccountProps } from './SidebarFooter';

interface MobileMoreSheetProps {
  role: NavRole;
  route: Route;
  pending: number;
  conn: ConnState;
  account: AccountProps;
  onNavigate: (to: Route) => void;
  onSearch: () => void;
  onClose: () => void;
}

// The phone's "Mais" tab: what does not fit the four tabs, plus the account menu.
export function MobileMoreSheet({ role, route, pending, conn, account, onNavigate, onSearch, onClose }: MobileMoreSheetProps) {
  const go = (to: Route) => () => { onClose(); onNavigate(to); };
  return (
    <BottomSheet
      onClose={onClose} label="Mais"
      content={
        <div className="flex flex-col gap-0.5">
          {canOpen(role, '/equipe') && (
            <SidebarItem icon="users" label="Equipe" expanded active={route === '/equipe'} onClick={go('/equipe')} count={pending} />
          )}
          {canOpen(role, '/explorar') && <SidebarItem icon="compass" label="Explorar" expanded active={route === '/explorar'} onClick={go('/explorar')} />}
          <SidebarItem icon="search" label="Buscar" expanded onClick={() => { onClose(); onSearch(); }} />
          {canOpen(role, '/configuracoes') && <SidebarItem icon="sliders" label="Configurações" expanded active={route === '/configuracoes'} onClick={go('/configuracoes')} />}
          <div className="mt-2 border-t border-neutral-800 pt-2">
            <ProfileMenu {...account} conn={conn} role={role} placement="down-end" variant="row" routes={sidebarNav(role)} route={route} nav={(to) => { onClose(); onNavigate(to); }} />
          </div>
        </div>
      }
    />
  );
}
