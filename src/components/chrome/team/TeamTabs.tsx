import type { ReactNode } from 'react';
import { Tabs } from '../../primitives/Tabs';
import { navigateTo } from '../../../lib/route-nav';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { teamTabsFor, type TeamTabId } from './team-tabs';

interface Props {
  role: NavRole;
  active: TeamTabId;
  counts?: Partial<Record<TeamTabId, number>>;
  allow?: TeamTabId[];
  actions?: ReactNode;
  onSelect?: (route: Route) => void;
}

export function TeamTabs({ role, active, counts, allow, actions, onSelect = navigateTo }: Props) {
  const tabs = teamTabsFor(role).filter((t) => !allow || allow.includes(t.id));
  if (!tabs.length) return null;
  return (
    <div className="flex min-h-14 shrink-0 items-center gap-6 border-b border-neutral-800/80 px-4 lg:px-7">
      <h2 className="font-display text-[19px] font-bold text-neutral-50 max-lg:hidden">Equipe</h2>
      <Tabs
        className="min-w-0 flex-1 border-0" items={tabs.map((t) => ({ id: t.id, label: t.label, count: counts?.[t.id] }))} active={active}
        onChange={(id) => onSelect(tabs.find((t) => t.id === id)!.route)}
      />
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}
