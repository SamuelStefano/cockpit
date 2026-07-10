import type { Route } from '../../useRoute';

export const NAV: { to: Route; label: string; adminOnly?: boolean }[] = [
  { to: '/', label: 'chat' },
  { to: '/contextos', label: 'contextos' },
  { to: '/skills', label: 'skills' },
  { to: '/notas', label: 'notas' },
  { to: '/pontos', label: 'pontos' },
  { to: '/crons', label: 'crons' },
  { to: '/uso', label: 'uso' },
  { to: '/graph', label: 'graph', adminOnly: true },
  { to: '/admin', label: 'admin', adminOnly: true },
  { to: '/docs', label: 'docs' },
];

// A aba admin some pra quem não é admin (default-deny: sem caps = não-admin).
export const navFor = (isAdmin: boolean) => NAV.filter((n) => !n.adminOnly || isAdmin);
