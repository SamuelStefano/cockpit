import type { Route } from '../../useRoute';

// `student`: what a non-admin is shown. The Equipe is their home (fatia E); the rest
// is either refused by the server (STUDENT_ALLOWED) or useless without a terminal.
export const NAV: { to: Route; label: string; adminOnly?: boolean; student?: true }[] = [
  { to: '/', label: 'chat', student: true },
  { to: '/contextos', label: 'contextos' },
  { to: '/skills', label: 'skills' },
  { to: '/notas', label: 'notas' },
  { to: '/pontos', label: 'pontos' },
  { to: '/crons', label: 'crons' },
  { to: '/equipe', label: 'equipe', student: true },
  { to: '/uso', label: 'uso' },
  { to: '/play', label: 'playground' },
  { to: '/canvas', label: 'canvas', adminOnly: true },
  { to: '/graph', label: 'graph', adminOnly: true },
  { to: '/harness', label: 'harness', adminOnly: true },
  { to: '/admin', label: 'admin', adminOnly: true },
  { to: '/docs', label: 'docs' },
];

// A aba admin some pra quem não é admin (default-deny: sem caps = não-admin).
export const navFor = (isAdmin: boolean) => (isAdmin ? NAV : NAV.filter((n) => n.student));

export const STUDENT_HOME: Route = '/equipe';

// Where a non-admin lands: the bare root goes to the Equipe once (a chat URL stays
// put), and a route outside their menu always does. null = stay.
export function studentRedirect(route: Route, chatId: string, firstLanding: boolean): Route | null {
  if (!NAV.some((n) => n.to === route && n.student)) return STUDENT_HOME;
  if (route === '/' && !chatId && firstLanding) return STUDENT_HOME;
  return null;
}

// Where the inline tab strip replaces the RouteMenu dropdown. Measured with a
// populated usage bar (header's right cluster ≈ 420px): the admin strip
// (14 tabs, ≈ 860px) needs ≈ 1380px and the 9-tab strip (≈ 550px) ≈ 1070px, so
// xl/lg still pushed the profile menu off-screen at exactly 1280/1024. The
// thresholds keep ~40px of slack for a longer usage label; past that the strip
// scrolls (Header.tsx) instead of pushing the right cluster out.
// Literal class names, so Tailwind's scanner sees them.
export const navBreakpoint = (isAdmin: boolean) =>
  isAdmin
    ? { strip: 'min-[1420px]:flex', menu: 'min-[1420px]:hidden' }
    : { strip: 'min-[1110px]:flex', menu: 'min-[1110px]:hidden' };
