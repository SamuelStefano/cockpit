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

// `student`: what a non-admin is shown. The chat (with the default agent) is their home; the rest
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
  { to: '/sala', label: 'Sala', icon: 'zap', side: true, tile: 'bg-orange-500/20 text-orange-300' },
  { to: '/base', label: 'Base', icon: 'layers', side: true, tile: 'bg-yellow-500/20 text-yellow-300' },
  { to: '/pontos', label: 'Pontos', icon: 'star', root: true, side: true, tile: 'bg-green-500/20 text-green-300' },
  { to: '/skills', label: 'Skills', icon: 'sparkles', side: true, tile: 'bg-violet-500/20 text-violet-300' },
  { to: '/conexoes', label: 'Conexões', icon: 'link', side: true, tile: 'bg-emerald-500/20 text-emerald-300' },
  { to: '/graph', label: 'Graph', icon: 'globe' },
  { to: '/docs', label: 'Docs', icon: 'book', side: true, tile: 'bg-neutral-500/20 text-neutral-300' },
  { to: '/agentes', label: 'Agente', icon: 'users', student: true },
  { to: '/equipe/rotinas', label: 'Rotinas', icon: 'clock', side: true, tile: 'bg-sky-500/20 text-sky-300' },
  { to: '/equipe/memoria', label: 'Memória', icon: 'brain', side: true, tile: 'bg-pink-500/20 text-pink-300' },
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

export const STUDENT_HOME: Route = '/';

// Where a non-admin lands: the home chat. A route outside their menu always goes there. null = stay.
export function studentRedirect(route: Route): Route | null {
  return NAV.some((n) => n.to === route && n.student) ? null : STUDENT_HOME;
}

// Where a role that opened a URL outside its menu goes. Root is never moved; /ds
// (the design-system gallery) stays reachable by URL for admins.
export function roleRedirect(role: NavRole, route: Route): Route | null {
  if (role === 'student') return studentRedirect(route);
  if (role === 'admin' && NAV.some((n) => n.to === route && n.root)) return '/';
  return null;
}
