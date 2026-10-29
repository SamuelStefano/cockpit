import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { usePersisted } from '../../../lib/persist';
import { sidebarNav } from './sidebar-nav';
import { SidebarItem } from './SidebarItem';
import { visibleNav } from './visible-nav';

interface SidebarNavProps {
  route: Route;
  nav: (to: Route) => void;
  role: NavRole;
  counts?: Partial<Record<Route, number>>;
  expanded: boolean;
  hideSingle?: boolean;
}

export function SidebarNav({ route, nav, role, counts, expanded, hideSingle }: SidebarNavProps) {
  const [showAll, setShowAll] = usePersisted('sidebar.navShowAll', false);
  const items = sidebarNav(role);
  if (!items.length || (hideSingle && items.length === 1)) return null;
  // The icon rail is compact enough to always list every route.
  const shown = visibleNav(items, showAll || !expanded, route, counts);
  const collapsible = expanded && visibleNav(items, false, route, counts).length < items.length;
  return (
    <nav aria-label="Rotas" className="flex flex-col gap-0.5">
      {shown.map((i) => (
        <SidebarItem key={i.to} icon={i.icon} tile={i.tile} label={i.label} expanded={expanded} active={route === i.to || route.startsWith(`${i.to}/`)} count={counts?.[i.to]} onClick={() => nav(i.to)} />
      ))}
      {collapsible && (
        <SidebarItem icon={showAll ? 'chevronUp' : 'chevronDown'} label={showAll ? 'Ver menos' : `Ver mais (${items.length - shown.length})`} expanded={expanded} expandedControl={showAll} onClick={() => setShowAll(!showAll)} />
      )}
    </nav>
  );
}
