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

// The conversations list is the chat and the agents section is the team, so
// neither route gets a nav row of its own (both stay reachable by URL).
const IN_SIDEBAR: Route[] = ['/', '/equipe'];
const PRIMARY: Route[] = ['/skills'];

// Same role gating as before: navFor decides what a role may see; the sidebar only
// decides where each entry sits (always visible vs. under "Mais").
export function splitNav(role: NavRole) {
  const all = navFor(role).filter((n) => !IN_SIDEBAR.includes(n.to));
  return {
    primary: PRIMARY.flatMap((to) => all.filter((n) => n.to === to)),
    more: all.filter((n) => !PRIMARY.includes(n.to)),
  };
}

export const navTitle = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);
