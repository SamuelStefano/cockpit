import { useState } from 'react';
import { Icon, Popover } from '../../primitives';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { NAV_ICONS, navTitle, splitNav } from './sidebar-nav';
import { SidebarItem } from './SidebarItem';

interface SidebarNavProps {
  route: Route;
  nav: (to: Route) => void;
  role: NavRole;
  counts?: Partial<Record<Route, number>>;
  expanded: boolean;
}

export function SidebarNav({ route, nav, role, counts, expanded }: SidebarNavProps) {
  const { primary, more } = splitNav(role);
  const moreActive = more.some((n) => n.to === route);
  const [moreOpen, setMoreOpen] = useState(moreActive);

  return (
    <nav aria-label="Rotas" className="flex flex-col gap-0.5">
      {primary.map((n) => (
        <SidebarItem key={n.to} icon={NAV_ICONS[n.to] ?? 'circle'} label={navTitle(n.label)} ariaLabel={n.label} expanded={expanded} active={route === n.to} count={counts?.[n.to]} onClick={() => nav(n.to)} />
      ))}
      {more.length > 0 && (expanded ? (
        <>
          <SidebarItem
            icon="ellipsis" label="Mais" expanded expandedControl={moreOpen}
            trailing={<Icon name={moreOpen ? 'chevronUp' : 'chevronDown'} size={13} />}
            onClick={() => setMoreOpen((o) => !o)}
          />
          {moreOpen && more.map((n) => (
            <SidebarItem key={n.to} icon={NAV_ICONS[n.to] ?? 'circle'} label={navTitle(n.label)} ariaLabel={n.label} expanded active={route === n.to} count={counts?.[n.to]} onClick={() => nav(n.to)} />
          ))}
        </>
      ) : (
        <Popover
          open={moreOpen} onClose={() => setMoreOpen(false)} label="Mais rotas" side="right" align="start"
          content={
            <ul className="flex w-44 flex-col gap-0.5 p-1.5">
              {more.map((n) => (
                <li key={n.to}>
                  <button
                    type="button" aria-label={n.label} aria-current={route === n.to ? 'page' : undefined}
                    onClick={() => { nav(n.to); setMoreOpen(false); }}
                    className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-[13px] transition ${route === n.to ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-300 hover:bg-neutral-800'}`}
                  >
                    <Icon name={NAV_ICONS[n.to] ?? 'circle'} size={16} />
                    {navTitle(n.label)}
                  </button>
                </li>
              ))}
            </ul>
          }
        >
          <SidebarItem icon="ellipsis" label="Mais" expanded={false} active={moreActive} expandedControl={moreOpen} haspopup onClick={() => setMoreOpen((o) => !o)} />
        </Popover>
      ))}
    </nav>
  );
}
