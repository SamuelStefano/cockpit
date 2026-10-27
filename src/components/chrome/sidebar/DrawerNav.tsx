import type { ReactNode } from 'react';
import { comboLabel } from '../../../lib/platform';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { SidebarItem } from './SidebarItem';
import { SidebarNav } from './SidebarNav';
import { SidebarAgents, type SidebarAgentsProps } from './SidebarAgents';

export interface DrawerNavProps {
  route: Route;
  nav: (to: Route) => void;
  role: NavRole;
  counts?: Partial<Record<Route, number>>;
  onPalette: () => void;
  agents?: SidebarAgentsProps;
  // The conversations list (SessionsPanel), between the agents and "Mais".
  sessions?: ReactNode;
}

// The phone drawer: the expanded sidebar's sections, top to bottom.
export function DrawerNav({ route, nav, role, counts, onPalette, agents, sessions }: DrawerNavProps) {
  const k = comboLabel(['⌘', 'K']);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-0.5 p-2">
        <SidebarItem icon="search" label="Buscar" ariaLabel={`Comandos (${k})`} expanded onClick={onPalette} />
        {agents && <SidebarAgents {...agents} expanded />}
      </div>
      {sessions ? <div className="min-h-0 flex-1">{sessions}</div> : <div className="flex-1" />}
      <div className="mx-2 shrink-0 border-t border-neutral-800 py-2">
        <SidebarNav route={route} nav={nav} role={role} counts={counts} expanded />
      </div>
    </div>
  );
}
