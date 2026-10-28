import type { IconName } from '../../primitives';
import type { Route } from '../../../useRoute';
import { navFor, type NavRole } from '../nav-routes';

export interface FooterNavItem {
  id: 'equipe' | 'skills' | 'conexoes' | 'configuracoes';
  label: string;
  icon: IconName;
  to: Route;
  // Colored tile behind the icon: each destination gets its own hue.
  tile?: string;
}

export const FOOTER_NAV: FooterNavItem[] = [
  { id: 'equipe', label: 'Equipe', icon: 'users', to: '/equipe', tile: 'bg-sky-500/20 text-sky-300' },
  { id: 'skills', label: 'Skills', icon: 'sparkles', to: '/skills', tile: 'bg-violet-500/20 text-violet-300' },
  { id: 'conexoes', label: 'Conexões', icon: 'link', to: '/conexoes', tile: 'bg-emerald-500/20 text-emerald-300' },
  { id: 'configuracoes', label: 'Configurações', icon: 'sliders', to: '/configuracoes' },
];

// navFor still decides what a role may open; the footer only lays the allowed
// entries out in the fixed order.
export function footerNav(role: NavRole): FooterNavItem[] {
  const allowed = navFor(role).map((n) => n.to);
  return FOOTER_NAV.filter((i) => allowed.includes(i.to));
}
