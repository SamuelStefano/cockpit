import { Skills, Conexoes, Docs } from './lazyRoutes';
import type { SettingsPages } from '../routes/Configuracoes';
import type { useCockpit } from '../useCockpit';
import { ManageProviders, ManageTools } from '../routes/conexoes/Manage';
import { VaultPanel } from '../components/vault/VaultPanel';
import { navigateTo } from '../lib/route-nav';

interface Args {
  cockpit: ReturnType<typeof useCockpit>;
  connected: boolean;
  isAdmin: boolean;
  isRoot: boolean;
  skillRoute: { id: string; open: (id: string) => void };
  onOpenAgentChat: (model: string) => void;
}

// The three screens that used to be top-level routes, now sections of Configurações.
// Conexões stays admin-only: settingsSections already hides it from a student.
export function settingsPages({ cockpit: c, connected, isAdmin, isRoot, skillRoute, onOpenAgentChat }: Args): SettingsPages {
  const manage = { agents: c.agents, onMcpsGet: c.onMcpsGet, term: c.term, models: c.models, isRoot, onOpenAgentChat };
  return {
    skills: (
      <Skills connected={connected} skills={c.skills} loaded={c.skillsLoaded} openSkill={c.openSkill} bots={c.bots}
        skillId={skillRoute.id} onToggleAgent={isAdmin ? c.onTeamSave : undefined} onNavigate={skillRoute.open}
        registry={c.registry} registryLoading={c.registryLoading} registryError={c.registryError} installing={c.installing}
        onSkillList={c.onSkillList} onSkillOpen={c.onSkillOpen} onSkillClose={c.onSkillClose}
        onRegistryGet={c.onRegistryGet} onRegistryInstall={c.onRegistryInstall} versions={c.versions} canRestoreVersions={isRoot} />
    ),
    conexoes: isAdmin ? (
      <Conexoes connected={connected} items={c.connections} loaded={c.connectionsLoaded} bots={c.bots}
        mcpsState={c.mcps} mcpsBusy={c.mcpsBusy} onGet={c.onConnectionsGet} onGo={navigateTo}
        probe={{ probeResult: c.probeResult, probeBusy: c.probeBusy, onProviderProbe: c.onProviderProbe, onProviderProbeReset: c.onProviderProbeReset }}
        manage={{ provedores: <ManageProviders {...manage} />, ferramentas: <ManageTools {...manage} />, chaves: isRoot ? <VaultPanel api={c} /> : undefined }} />
    ) : undefined,
    docs: <Docs />,
  };
}
