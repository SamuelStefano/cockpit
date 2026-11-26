import type { ReactNode } from 'react';
import { Tabs } from '../../primitives/Tabs';
import { setPref } from '../../../lib/persist';
import { navigateTo } from '../../../lib/route-nav';
import type { NavRole } from '../nav-routes';
import { workTabsFor, type WorkTabId } from './work-tabs';

interface Props {
  role: NavRole;
  active: WorkTabId;
  actions?: ReactNode;
}

// Canvas and Kanban are two views of the same route: the persisted `canvas.mode` picks which one opens.
function pick(id: WorkTabId, active: WorkTabId, route: string) {
  if (id === 'kanban') setPref('canvas.mode', 'kanban');
  else if (id === 'canvas' && active === 'kanban') setPref('canvas.mode', 'canvas');
  navigateTo(route);
}

export function WorkTabs({ role, active, actions }: Props) {
  const tabs = workTabsFor(role);
  if (!tabs.length) return null;
  return (
    <div className="flex min-h-14 shrink-0 items-center gap-6 border-b border-neutral-800/80 px-4 lg:px-7">
      <h2 className="font-display text-[19px] font-bold text-neutral-50 max-lg:hidden">Trabalho</h2>
      <Tabs
        className="min-w-0 flex-1 border-0" items={tabs.map((t) => ({ id: t.id, label: t.label }))} active={active}
        onChange={(id) => pick(id, active, tabs.find((t) => t.id === id)!.route)}
      />
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}
