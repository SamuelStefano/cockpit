// Deep links from the model picker and onboarding into Conexões. useRoute only
// listens to popstate, so a programmatic push has to emit one for the view to switch.
export type ConnectionsTab = 'provedores' | 'ferramentas' | 'aparelhos';

const TAB_OF: Record<string, ConnectionsTab> = { agents: 'provedores', models: 'provedores', mcps: 'ferramentas' };

export function connectionsTabFromHash(hash: string): ConnectionsTab | null {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  return id === 'provedores' || id === 'ferramentas' || id === 'aparelhos' ? id : null;
}

export function openAdminTab(tab: 'agents' | 'models' | 'mcps'): void {
  history.pushState(null, '', `/conexoes#${TAB_OF[tab]}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
