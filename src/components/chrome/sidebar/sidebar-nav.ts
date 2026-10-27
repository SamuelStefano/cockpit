import type { IconName } from '../../primitives';
import type { Route } from '../../../useRoute';
import { navFor, type NavRole } from '../nav-routes';

export const NAV_ICONS: Partial<Record<Route, IconName>> = {
  '/': 'message',
  '/equipe': 'users',
  '/skills': 'sparkles',
  '/contextos': 'layers',
  '/pontos': 'star',
  '/crons': 'clock',
  '/uso': 'zap',
  '/canvas': 'split',
  '/graph': 'link',
  '/painel': 'monitor',
  '/docs': 'file',
};

const PRIMARY: Route[] = ['/', '/equipe', '/skills'];

// Same role gating as before: navFor decides what a role may see; the sidebar only
// decides where each entry sits (always visible vs. under "Mais").
export function splitNav(role: NavRole) {
  const all = navFor(role);
  return {
    primary: PRIMARY.flatMap((to) => all.filter((n) => n.to === to)),
    more: all.filter((n) => !PRIMARY.includes(n.to)),
  };
}

export const navTitle = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);
