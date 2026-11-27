import type { Route } from '../../../useRoute';
import { navFor, type NavRole } from '../nav-routes';

export type WorkTabId = 'kanban' | 'canvas' | 'prs' | 'pontos';

export interface WorkTabDef {
  id: WorkTabId;
  label: string;
  route: Route;
}

const ALL: WorkTabDef[] = [
  { id: 'kanban', label: 'Kanban', route: '/canvas' },
  { id: 'canvas', label: 'Canvas', route: '/canvas' },
  { id: 'prs', label: 'PRs', route: '/prs' },
  { id: 'pontos', label: 'Pontos', route: '/pontos' },
];

export function workTabsFor(role: NavRole): WorkTabDef[] {
  const allowed = new Set(navFor(role).map((n) => n.to));
  return ALL.filter((t) => allowed.has(t.route));
}
