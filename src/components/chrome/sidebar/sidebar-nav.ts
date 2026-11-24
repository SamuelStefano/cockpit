import { navFor, type NavItem, type NavRole } from '../nav-routes';

// The sidebar lists the entries NAV flags as `side`; navFor decides what a role may open.
export function sidebarNav(role: NavRole): NavItem[] {
  return navFor(role).filter((i) => i.side);
}

export const canOpenSettings = (role: NavRole): boolean => navFor(role).some((i) => i.to === '/configuracoes');
