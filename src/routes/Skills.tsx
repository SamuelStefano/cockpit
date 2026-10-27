import { useEffect } from 'react';
import { Badge, Button, EmptyState, SkeletonCards, RouteHeader, Tabs } from '../components/primitives';
import { useLoadStalled } from '../lib/useLoadStalled';
import type { RegistryCatalog, RegistryRef, SkillMeta, TeamBot } from '../../shared/protocol';
import type { SkillDoc } from '../useCockpit';
import { botWithSkillToggled } from './skills/toggle-agent';
import { SkillPage } from './skills/SkillPage';
import { VersionsModal } from '../components/versions/VersionsModal';
import type { VersionsApi } from '../cockpit/useVersions';
import { SkillsOffline } from './skills/SkillsOffline';
import { SkillsEmpty } from './skills/SkillsEmpty';
import { SkillsSearch } from './skills/SkillsSearch';
import { InstalledView } from './skills/InstalledView';
import { Filters } from './skills/Filters';
import { PacksView } from './skills/PacksView';
import { DiscoverView } from './skills/DiscoverView';
import { RegistryNotice } from './skills/RegistryNotice';
import { PublicOnlyHint } from './skills/PublicOnlyHint';
import { useSkillsView, type SkillsTab } from './skills/useSkillsView';

interface Props {
  connected: boolean;
  skills: SkillMeta[];
  loaded: boolean;
  openSkill: SkillDoc | null;
  bots: TeamBot[];
  skillId: string;
  registry: RegistryCatalog | null;
  registryLoading: boolean;
  registryError: string | null;
  installing: ReadonlySet<string>;
  onToggleAgent?: (bot: import('../../shared/protocol').TeamBotInput) => void;
  onNavigate: (id: string) => void;
  onSkillList: () => void;
  onSkillOpen: (id: string) => void;
  onSkillClose: () => void;
  onRegistryGet: (refresh?: boolean) => void;
  onRegistryInstall: (key: string, items: RegistryRef[]) => void;
  versions: VersionsApi;
  canRestoreVersions: boolean;
}

export function Skills(p: Props) {
  const { connected, skills, loaded, registry, registryLoading, registryError, skillId, onSkillList, onSkillOpen, onSkillClose, onRegistryGet } = p;
  const v = useSkillsView(skills, registry);

  useEffect(() => { if (connected) onSkillList(); }, [connected, onSkillList]);
  useEffect(() => { if (connected && !registry && !registryLoading && !registryError) onRegistryGet(); }, [connected, registry, registryLoading, registryError, onRegistryGet]);
  useEffect(() => {
    if (!connected || !skillId) return;
    onSkillOpen(skillId);
    return onSkillClose;
  }, [connected, skillId, onSkillOpen, onSkillClose]);
  const { stalled, retry } = useLoadStalled(loaded, connected);

  const tabs: { id: SkillsTab; label: string; count?: number }[] = [
    { id: 'installed', label: 'Instaladas', count: v.counts.installed },
    { id: 'discover', label: 'Descobrir', count: v.counts.discover },
    { id: 'packs', label: 'Packs', count: v.counts.packs },
  ];
  const registryBlocked = !registry && (registryLoading || registryError);

  if (skillId) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-neutral-950">
        <div className="scroll-thin flex-1 overflow-y-auto p-4 md:p-6">
          {!connected ? <SkillsOffline /> : (
            <SkillPage skill={skills.find((s) => s.id === skillId)} doc={p.openSkill} skillId={skillId} bots={p.bots} loaded={loaded} onBack={() => p.onNavigate('')} onVersions={() => p.versions.open(skillId)}
              onToggleAgent={p.onToggleAgent && ((sid, botId, on) => { const b = p.bots.find((x) => x.id === botId); if (b) p.onToggleAgent?.(botWithSkillToggled(b, skills, sid, on)); })} />
          )}
        </div>
        <VersionsModal api={p.versions} title={skills.find((s) => s.id === skillId)?.name ?? skillId} canRestore={p.canRestoreVersions} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-neutral-950">
      <RouteHeader variant="bar" title="skills" badge={<Badge tone="neutral">{skills.length}</Badge>}
        subtitle="O que cada agente sabe fazer. Ligue por agente na página dele."
        actions={<SkillsSearch value={v.query} onChange={v.setQuery} inputRef={v.searchRef} />} />
      {!connected ? (
        <SkillsOffline />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Tabs items={tabs} active={v.tab} onChange={v.setTab} className="overflow-x-auto px-4" compact
            right={registry && <Button variant="ghost" size="sm" icon="rotate" loading={registryLoading} onClick={() => onRegistryGet(true)}
              aria-label="Atualizar o registro" title="Atualizar o registro" className="max-sm:w-7 max-sm:gap-0 max-sm:px-0"><span className="max-sm:sr-only">Registro</span></Button>} />
          <div className="scroll-thin flex-1 overflow-y-auto p-4">
            <div className="mx-auto w-full max-w-240">
              {v.tab === 'installed' ? (
                !loaded ? (
                  stalled ? (
                    <EmptyState icon="x" title="Não deu pra carregar as skills" description="O servidor não respondeu com a lista. Tente de novo.">
                      <Button icon="rotate" onClick={() => { retry(); onSkillList(); }}>Tentar de novo</Button>
                    </EmptyState>
                  ) : <SkeletonCards />
                ) : skills.length === 0 ? (
                  <SkillsEmpty query={v.query} onDiscover={() => v.setTab('discover')} />
                ) : (
                  <>
                    <Filters chips={v.chips} source={v.source} risk={v.risk} onSource={v.setSource} onRisk={v.setRisk} />
                    <InstalledView skills={v.installed} bots={p.bots} onOpen={p.onNavigate} />
                  </>
                )
              ) : registryBlocked ? (
                <RegistryNotice loading={registryLoading} error={registryError} onRetry={() => onRegistryGet(true)} />
              ) : (
                <>
                  {registry?.publicOnly && <PublicOnlyHint />}
                  {v.tab === 'packs' ? (
                    <PacksView packs={v.packs} installing={p.installing} onInstall={p.onRegistryInstall} onOpen={p.onNavigate} />
                  ) : (
                    <DiscoverView skills={v.discover} installing={p.installing} onInstall={p.onRegistryInstall} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
