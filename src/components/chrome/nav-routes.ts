import type { Route } from '../../useRoute';

export const NAV: { to: Route; label: string; adminOnly?: boolean }[] = [
  { to: '/', label: 'chat' },
  { to: '/contextos', label: 'contextos' },
  { to: '/skills', label: 'skills' },
  { to: '/notas', label: 'notas' },
  { to: '/pontos', label: 'pontos' },
  { to: '/crons', label: 'crons' },
  { to: '/uso', label: 'uso' },
  { to: '/play', label: 'playground' },
  { to: '/canvas', label: 'canvas', adminOnly: true },
  { to: '/graph', label: 'graph', adminOnly: true },
  { to: '/harness', label: 'harness', adminOnly: true },
  { to: '/admin', label: 'admin', adminOnly: true },
  { to: '/docs', label: 'docs' },
];

// A aba admin some pra quem não é admin (default-deny: sem caps = não-admin).
export const navFor = (isAdmin: boolean) => NAV.filter((n) => !n.adminOnly || isAdmin);

// Where the inline tab strip replaces the RouteMenu dropdown. Measured widths
// (header's right cluster ≈ 350px): the admin strip (13 tabs, ≈ 790px) only
// fits from xl; at md it pushed the usage bar, ⌘K, ws and the profile menu
// off-screen from 768 to 1279px. The 9-tab strip (≈ 520px) fits from lg.
// Literal class names, so Tailwind's scanner sees them.
export const navBreakpoint = (isAdmin: boolean) =>
  isAdmin ? { strip: 'xl:flex', menu: 'xl:hidden' } : { strip: 'lg:flex', menu: 'lg:hidden' };
