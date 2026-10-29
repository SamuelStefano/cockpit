import type { Route } from '../../useRoute';
import type { IconName } from '../primitives';
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
export interface NavItem {
  to: Route;
  label: string;
  icon: IconName;
  student?: true;
  root?: true;
  // Listed in the sidebar nav, in this order; `tile` is the coloured square behind the icon.
  side?: true;
  tile?: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Chat', icon: 'message', student: true },
  { to: '/canvas', label: 'Canvas', icon: 'grip', side: true, tile: 'bg-amber-500/20 text-amber-300' },
  { to: '/pontos', label: 'Pontos', icon: 'star', root: true },
  { to: '/equipe', label: 'Equipe', icon: 'users', student: true, side: true, tile: 'bg-sky-500/20 text-sky-300' },
  { to: '/skills', label: 'Skills', icon: 'sparkles', side: true, tile: 'bg-violet-500/20 text-violet-300' },
  { to: '/conexoes', label: 'Conexões', icon: 'link', side: true, tile: 'bg-emerald-500/20 text-emerald-300' },
  { to: '/graph', label: 'Graph', icon: 'globe' },
  { to: '/docs', label: 'Docs', icon: 'book', side: true, tile: 'bg-neutral-500/20 text-neutral-300' },
  { to: '/agentes', label: 'Agente', icon: 'users', student: true },
  { to: '/equipe/rotinas', label: 'Rotinas', icon: 'clock' },
  { to: '/equipe/memoria', label: 'Memória', icon: 'brain' },
  { to: '/configuracoes', label: 'Configurações', icon: 'sliders', student: true },
];

// Page title for a route: the exact entry, else the longest entry it lives under.
export function navLabel(route: Route): string | undefined {
  const hit = NAV.find((n) => n.to === route)
    ?? NAV.filter((n) => n.to !== '/' && route.startsWith(`${n.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];
  return hit?.label;
}

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
