import type { IconName } from '../../components/primitives';
import type { NavRole } from '../../components/chrome/nav-routes';
import type { Route } from '../../useRoute';
import { inShell } from '../../lib/shell';

export type SettingsSection = 'conta' | 'uso' | 'pessoas' | 'maquina' | 'maquinas' | 'skills' | 'conexoes' | 'docs' | 'avancado';

export const SECTION_ROUTE: Record<SettingsSection, Route> = {
  conta: '/configuracoes',
  uso: '/configuracoes/uso',
  pessoas: '/configuracoes/pessoas',
  maquina: '/configuracoes/maquina',
  maquinas: '/configuracoes/maquinas',
  skills: '/configuracoes/skills',
  conexoes: '/configuracoes/conexoes',
  docs: '/configuracoes/docs',
  avancado: '/configuracoes/avancado',
};

export interface SectionItem { id: SettingsSection; label: string; icon: IconName }

const ALL: SectionItem[] = [
  { id: 'conta', label: 'Conta', icon: 'user' },
  { id: 'uso', label: 'Uso', icon: 'zap' },
  { id: 'pessoas', label: 'Pessoas', icon: 'users' },
  { id: 'maquina', label: 'Máquina', icon: 'monitor' },
  { id: 'maquinas', label: 'Máquinas', icon: 'cpu' },
  { id: 'skills', label: 'Skills', icon: 'sparkles' },
  { id: 'conexoes', label: 'Conexões', icon: 'link' },
  { id: 'docs', label: 'Docs', icon: 'book' },
  { id: 'avancado', label: 'Avançado', icon: 'shield' },
];

export function sectionOf(route: Route): SettingsSection {
  return (Object.keys(SECTION_ROUTE) as SettingsSection[]).find((s) => SECTION_ROUTE[s] === route) ?? 'conta';
}

// Default-deny: a student sees Conta and Máquinas (the box switcher left the sidebar) only; Skills, Conexões and Docs are for admin and root. Pessoas lists every account, which the
// server hands to the root alone and only when accounts exist (Supabase on).
export function settingsSections(role: NavRole, accountsEnabled: boolean): SectionItem[] {
  if (role === 'student') return ALL.filter((s) => s.id === 'conta' || s.id === 'maquinas');
  // Plan usage is hidden in the store build.
  return ALL.filter((s) => (s.id !== 'pessoas' || (role === 'root' && accountsEnabled)) && (s.id !== 'uso' || !inShell()));
}
