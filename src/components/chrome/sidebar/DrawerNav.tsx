import { comboLabel } from '../../../lib/platform';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { SidebarItem } from './SidebarItem';
import { SidebarNav } from './SidebarNav';

export interface DrawerNavProps {
  route: Route;
  nav: (to: Route) => void;
  role: NavRole;
  counts?: Partial<Record<Route, number>>;
  onPalette: () => void;
}

// The expanded sidebar nav, for the phone drawer (above the sessions list on the chat).
export function DrawerNav({ route, nav, role, counts, onPalette }: DrawerNavProps) {
  const k = comboLabel(['⌘', 'K']);
  return (
    <div className="flex shrink-0 flex-col gap-0.5 border-b border-neutral-800 p-2">
      <SidebarItem icon="search" label="Buscar" ariaLabel={`Comandos (${k})`} expanded onClick={onPalette} />
      <SidebarNav route={route} nav={nav} role={role} counts={counts} expanded />
    </div>
  );
}
