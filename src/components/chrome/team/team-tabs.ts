import type { Route } from '../../../useRoute';
import { navFor, type NavRole } from '../nav-routes';

export type TeamTabId = 'pedidos' | 'rotinas' | 'memoria' | 'mundo';

export interface TeamTabDef {
  id: TeamTabId;
  label: string;
  route: Route;
}

const ALL: TeamTabDef[] = [
  { id: 'pedidos', label: 'Pedidos', route: '/equipe' },
  { id: 'rotinas', label: 'Rotinas', route: '/equipe/rotinas' },
  { id: 'memoria', label: 'Memória', route: '/equipe/memoria' },
  { id: 'mundo', label: 'Mundo', route: '/equipe/mundo' },
];

export function teamTabsFor(role: NavRole): TeamTabDef[] {
  const allowed = new Set(navFor(role).map((n) => n.to));
  return ALL.filter((t) => allowed.has(t.route));
}
