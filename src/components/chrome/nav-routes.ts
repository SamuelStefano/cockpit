import type { Route } from '../../useRoute';
import type { Caps } from '../../../shared/protocol';

// The account role as far as navigation goes. Default-deny: no caps yet = student.
export type NavRole = 'root' | 'admin' | 'student';

export function navRole(role: Caps['role'] | undefined): NavRole {
  if (role === 'root') return 'root';
  if (role === 'admin') return 'admin';
  return 'student';
}

// `student`: what a non-admin is shown. The Equipe is their home (fatia E); the rest
// is either refused by the server (STUDENT_ALLOWED) or useless without a terminal.
// `root`: the owner only — the server refuses its frames to anyone else
// (shared/root-frames.ts).
export const NAV: { to: Route; label: string; student?: true; root?: true }[] = [
  { to: '/', label: 'chat', student: true },
    { to: '/skills', label: 'skills' },
  { to: '/pontos', label: 'pontos', root: true },
  { to: '/equipe', label: 'equipe', student: true },
  { to: '/equipe/rotinas', label: 'rotinas' },
  { to: '/equipe/memoria', label: 'memória' },
  { to: '/agentes', label: 'Agentes', student: true },
  { to: '/configuracoes', label: 'configurações', student: true },
  { to: '/canvas', label: 'canvas' },
  { to: '/graph', label: 'graph' },
  { to: '/conexoes', label: 'conexões' },
  { to: '/docs', label: 'docs' },
];

export function navFor(role: NavRole) {
  if (role === 'root') return NAV;
  if (role === 'admin') return NAV.filter((n) => !n.root);
  return NAV.filter((n) => n.student);
}

export const STUDENT_HOME: Route = '/equipe';

// Where a non-admin lands: the bare root goes to the Equipe once (a chat URL stays
// put), and a route outside their menu always does. null = stay.
export function studentRedirect(route: Route, chatId: string, firstLanding: boolean): Route | null {
  if (!NAV.some((n) => n.to === route && n.student)) return STUDENT_HOME;
  if (route === '/' && !chatId && firstLanding) return STUDENT_HOME;
  return null;
}

// Where a role that opened a URL outside its menu goes. Root is never moved; /ds
// (the design-system gallery) stays reachable by URL for admins.
export function roleRedirect(role: NavRole, route: Route, chatId: string, firstLanding: boolean): Route | null {
  if (role === 'student') return studentRedirect(route, chatId, firstLanding);
  if (role === 'admin' && NAV.some((n) => n.to === route && n.root)) return '/';
  return null;
}
