import { Icon, type IconName } from '../../primitives';
import type { Route } from '../../../useRoute';
import { navFor, type NavRole } from '../nav-routes';

export type TabId = 'equipe' | 'conversas' | 'canvas' | 'mais';

interface Tab { id: TabId; label: string; icon: IconName; route?: Route }

const TABS: Tab[] = [
  { id: 'equipe', label: 'Equipe', icon: 'users', route: '/equipe' },
  { id: 'conversas', label: 'Conversas', icon: 'message' },
  { id: 'canvas', label: 'Canvas', icon: 'grip', route: '/canvas' },
  { id: 'mais', label: 'Mais', icon: 'ellipsis' },
];

// Tabs a role can open: route tabs follow the same menu list as the sidebar.
export function tabsFor(role: NavRole): Tab[] {
  const allowed = new Set(navFor(role).map((n) => n.to));
  return TABS.filter((t) => !t.route || allowed.has(t.route));
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
  return (
    <nav
      aria-label="Navegação principal"
      className="flex shrink-0 border-t border-neutral-800 bg-neutral-950"
    >
      {tabsFor(role).map((t) => {
        const active = t.route !== undefined && route === t.route;
        const press = () => (t.route ? onNavigate(t.route) : t.id === 'conversas' ? onConversations() : onMore());
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
