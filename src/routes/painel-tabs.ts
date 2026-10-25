import type { AdminTab } from './AdminTabs';

// Host (env, MCP, CLI, Deck update/restart) and Contas (every account's e-mail)
// are the owner's: the server refuses their frames to a plain admin anyway
// (shared/root-frames.ts, relay canListAccounts), so the tabs are not shown.
export function painelTabs(isRoot: boolean, accountsEnabled: boolean): AdminTab[] {
  const t: AdminTab[] = [{ id: 'overview', label: 'Visão geral', icon: 'zap' }];
  if (isRoot && accountsEnabled) t.push({ id: 'accounts', label: 'Contas', icon: 'user' });
  if (isRoot) t.push({ id: 'host', label: 'Host', icon: 'terminal' });
  t.push({ id: 'agents', label: 'Agentes', icon: 'sparkles' });
  t.push({ id: 'models', label: 'Modelos', icon: 'layers' });
  return t;
}
