import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { footerNav } from './sidebar-nav';
import { SidebarItem } from './SidebarItem';

interface SidebarNavProps {
  route: Route;
  nav: (to: Route) => void;
  role: NavRole;
  counts?: Partial<Record<Route, number>>;
  expanded: boolean;
}

export function SidebarNav({ route, nav, role, counts, expanded }: SidebarNavProps) {
  const items = footerNav(role).filter((i) => i.id !== 'configuracoes');
  if (!items.length) return null;
  return (
    <nav aria-label="Rotas" className="flex flex-col gap-0.5">
      {items.map((i) => (
        <SidebarItem key={i.id} icon={i.icon} tile={i.tile} label={i.label} expanded={expanded} active={route === i.to || route.startsWith(`${i.to}/`)} count={counts?.[i.to]} onClick={() => nav(i.to)} />
      ))}
    </nav>
  );
}
