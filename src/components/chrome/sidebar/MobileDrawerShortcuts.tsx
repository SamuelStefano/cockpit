import type { BotView } from '../../../routes/equipe/team-view';
import type { Route } from '../../../useRoute';
import { Badge, Icon, tokens, type IconName } from '../../primitives';
import type { NavRole } from '../nav-routes';
import { canOpen, workRoute } from '../rail/rail-order';
import { pendingRequests } from './mobile-pending';

interface MobileDrawerShortcutsProps {
  role: NavRole;
  views: BotView[];
  onNavigate: (to: Route) => void;
}

interface Shortcut { label: string; icon: IconName; to: Route; count?: number }

export function drawerShortcuts(role: NavRole, views: BotView[]): Shortcut[] {
  const work = workRoute(role);
  const all: (Shortcut | null)[] = [
    canOpen(role, '/equipe') ? { label: 'Equipe', icon: 'users', to: '/equipe', count: pendingRequests(views) } : null,
    canOpen(role, '/agentes') ? { label: 'Agentes', icon: 'users', to: '/agentes' } : null,
    work ? { label: 'Trabalho', icon: 'grip', to: work } : null,
    canOpen(role, '/explorar') ? { label: 'Explorar', icon: 'compass', to: '/explorar' } : null,
  ];
  return all.filter((s): s is Shortcut => !!s);
}

// Phone drawer: the destinations the bottom bar offers elsewhere, one tap from the chat.
export function MobileDrawerShortcuts({ role, views, onNavigate }: MobileDrawerShortcutsProps) {
  const items = drawerShortcuts(role, views);
  if (!items.length) return null;
  return (
    <nav aria-label="Atalhos" className="flex shrink-0 gap-1.5 px-2.5 pb-2">
      {items.map((s) => (
        <button
          key={s.to} type="button" onClick={() => onNavigate(s.to)}
          className={`flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg bg-neutral-800/60 text-[11px] text-neutral-300 ${tokens.focusRing}`}
        >
          <span className="flex items-center gap-1"><Icon name={s.icon} size={15} />{!!s.count && <Badge tone="orange">{s.count}</Badge>}</span>
          <span className="max-w-full truncate">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
