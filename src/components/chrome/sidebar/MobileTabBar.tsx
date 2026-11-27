import { Icon, type IconName } from '../../primitives';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { canOpen, isWorkRoute, workRoute } from '../rail/rail-order';

export type TabId = 'chats' | 'agentes' | 'trabalho' | 'mais';

interface Tab { id: TabId; label: string; icon: IconName }

const TABS: Tab[] = [
  { id: 'chats', label: 'Chats', icon: 'message' },
  { id: 'agentes', label: 'Agentes', icon: 'users' },
  { id: 'trabalho', label: 'Trabalho', icon: 'grip' },
  { id: 'mais', label: 'Mais', icon: 'ellipsis' },
];

// Tabs a role can open: the route tabs follow the same menu list as the sidebar.
export function tabsFor(role: NavRole): Tab[] {
  return TABS.filter((t) => (t.id === 'agentes' ? canOpen(role, '/agentes') : t.id === 'trabalho' ? workRoute(role) !== null : true));
}

interface MobileTabBarProps {
  role: NavRole;
  route: Route;
  onNavigate: (to: Route) => void;
  onConversations: () => void;
  onMore: () => void;
}

// Phone bottom bar. The app root already pads the bottom safe-area inset, so the bar adds none;
// the page hides it while the keyboard is open.
export function MobileTabBar({ role, route, onNavigate, onConversations, onMore }: MobileTabBarProps) {
  const work = workRoute(role);
  return (
    <nav
      aria-label="Navegação principal"
      className="flex shrink-0 border-t border-neutral-800 bg-neutral-950"
    >
      {tabsFor(role).map((t) => {
        const active = t.id === 'agentes' ? route === '/agentes' || route.startsWith('/agentes/') : t.id === 'trabalho' && isWorkRoute(route);
        const press = () => {
          if (t.id === 'chats') onConversations();
          else if (t.id === 'agentes') onNavigate('/agentes');
          else if (t.id === 'trabalho') { if (work) onNavigate(work); }
          else onMore();
        };
        return (
          <button
            key={t.id} type="button" onClick={press} aria-current={active ? 'page' : undefined}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-orange-400' : 'text-neutral-500'}`}
          >
            <Icon name={t.icon} size={20} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
