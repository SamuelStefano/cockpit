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

// Where the inline tab strip replaces the RouteMenu dropdown. Measured with a
// populated usage bar (header's right cluster ≈ 420px): the admin strip
// (13 tabs, ≈ 795px) needs ≈ 1315px and the 9-tab strip (≈ 550px) ≈ 1070px, so
// xl/lg still pushed the profile menu off-screen at exactly 1280/1024. The
// thresholds keep ~40px of slack for a longer usage label; past that the strip
// scrolls (Header.tsx) instead of pushing the right cluster out.
// Literal class names, so Tailwind's scanner sees them.
export const navBreakpoint = (isAdmin: boolean) =>
  isAdmin
    ? { strip: 'min-[1360px]:flex', menu: 'min-[1360px]:hidden' }
    : { strip: 'min-[1110px]:flex', menu: 'min-[1110px]:hidden' };
