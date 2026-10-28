import type { IconName } from '../../components/primitives';
import type { NavRole } from '../../components/chrome/nav-routes';
import type { Route } from '../../useRoute';

export type SettingsSection = 'conta' | 'uso' | 'pessoas' | 'maquina' | 'avancado';

export const SECTION_ROUTE: Record<SettingsSection, Route> = {
  conta: '/configuracoes',
  uso: '/configuracoes/uso',
  pessoas: '/configuracoes/pessoas',
  maquina: '/configuracoes/maquina',
  avancado: '/configuracoes/avancado',
};

export interface SectionItem { id: SettingsSection; label: string; icon: IconName }

const ALL: SectionItem[] = [
  { id: 'conta', label: 'Conta', icon: 'user' },
  { id: 'uso', label: 'Uso', icon: 'zap' },
  { id: 'pessoas', label: 'Pessoas', icon: 'users' },
  { id: 'maquina', label: 'Máquina', icon: 'monitor' },
  { id: 'avancado', label: 'Avançado', icon: 'shield' },
];

export function sectionOf(route: Route): SettingsSection {
  return (Object.keys(SECTION_ROUTE) as SettingsSection[]).find((s) => SECTION_ROUTE[s] === route) ?? 'conta';
}

// Default-deny: a student sees Conta only. Pessoas lists every account, which the
// server hands to the root alone and only when accounts exist (Supabase on).
export function settingsSections(role: NavRole, accountsEnabled: boolean): SectionItem[] {
  if (role === 'student') return ALL.filter((s) => s.id === 'conta');
  return ALL.filter((s) => s.id !== 'pessoas' || (role === 'root' && accountsEnabled));
}
