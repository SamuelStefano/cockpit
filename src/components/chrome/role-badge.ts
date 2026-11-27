import type { NavRole } from './nav-routes';

export interface RoleBadgeInfo { label: string; tone: 'orange' | 'neutral'; title: string }

// A student sees no badge: the role only matters to whoever has extra powers.
export function roleBadge(role: NavRole): RoleBadgeInfo | null {
  if (role === 'root') return { label: 'root', tone: 'orange', title: 'Você está como root: acesso total, incluindo pontos, host e contas.' };
  if (role === 'admin') return { label: 'admin', tone: 'neutral', title: 'Você está como admin: Painel com visão geral, agentes e modelos. Pontos, host e contas são do root.' };
  return null;
}
