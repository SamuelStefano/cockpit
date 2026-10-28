import type { IconName } from '../../primitives';
import type { Route } from '../../../useRoute';
import { navFor, type NavRole } from '../nav-routes';

export interface FooterNavItem {
  id: 'equipe' | 'skills' | 'conexoes' | 'configuracoes';
  label: string;
  icon: IconName;
  to: Route;
}

// Configurações has no screen of its own yet (slice 15+):
// until then it opens the closest existing route, so the footer is already final.
export const FOOTER_NAV: FooterNavItem[] = [
  { id: 'equipe', label: 'Equipe', icon: 'users', to: '/equipe' },
  { id: 'skills', label: 'Skills', icon: 'sparkles', to: '/skills' },
  { id: 'conexoes', label: 'Conexões', icon: 'link', to: '/conexoes' },
  { id: 'configuracoes', label: 'Configurações', icon: 'sliders', to: '/uso' },
];

// navFor still decides what a role may open; the footer only lays the allowed
// entries out in the fixed order.
export function footerNav(role: NavRole): FooterNavItem[] {
  const allowed = navFor(role).map((n) => n.to);
  return FOOTER_NAV.filter((i) => allowed.includes(i.to));
}
