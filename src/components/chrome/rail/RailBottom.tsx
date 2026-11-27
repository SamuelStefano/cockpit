import { ProfileMenu } from '../../ProfileMenu';
import type { ConnState } from '../../primitives';
import { comboLabel } from '../../../lib/platform';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import type { AccountProps } from '../sidebar/SidebarFooter';
import { canOpenSettings, sidebarNav } from '../sidebar/sidebar-nav';
import { canOpen, isWorkRoute, workRoute } from './rail-order';
import { RailNavButton } from './RailNavButton';

export interface RailBottomProps {
  role: NavRole;
  route: Route;
  nav: (to: Route) => void;
  navCounts?: Partial<Record<Route, number>>;
  pendingCount: number;
  onPalette: () => void;
  account: AccountProps;
  conn: ConnState;
}

export function RailBottom({ role, route, nav, navCounts, pendingCount, onPalette, account, conn }: RailBottomProps) {
  const work = workRoute(role);
  const k = comboLabel(['⌘', 'K']);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      {work && <RailNavButton icon="grip" label="Trabalho" active={isWorkRoute(route)} onClick={() => nav(work)} />}
      {canOpen(role, '/equipe') && <RailNavButton icon="users" label="Equipe" active={route.startsWith('/equipe')} count={pendingCount} onClick={() => nav('/equipe')} />}
      {canOpen(role, '/explorar') && <RailNavButton icon="compass" label="Explorar" active={route === '/explorar'} onClick={() => nav('/explorar')} />}
      <RailNavButton icon="search" label="Buscar" ariaLabel={`Comandos (${k})`} tip={`Buscar · ${k}`} onClick={onPalette} />
      {canOpenSettings(role) && <RailNavButton icon="sliders" label="Ajustes" ariaLabel="Configurações" active={route.startsWith('/configuracoes')} onClick={() => nav('/configuracoes')} />}
      <div className="mt-1.5">
        <ProfileMenu {...account} conn={conn} role={role} placement="up-start" variant="rail" routes={sidebarNav(role)} route={route} nav={nav} counts={navCounts} />
      </div>
    </div>
  );
}
