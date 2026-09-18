import { useEffect } from 'react';
import { Badge, Button, EmptyState, SkeletonCards, RouteHeader, Tabs } from '../components/primitives';
import { useLoadStalled } from '../lib/useLoadStalled';
import type { RegistryCatalog, RegistryRef, SkillMeta } from '../../shared/protocol';
import type { SkillDoc } from '../useCockpit';
import { SkillModal } from './skills/SkillModal';
import { SkillsOffline } from './skills/SkillsOffline';
import { SkillsEmpty } from './skills/SkillsEmpty';
import { SkillsSearch } from './skills/SkillsSearch';
import { InstalledView } from './skills/InstalledView';
import { PacksView } from './skills/PacksView';
import { DiscoverView } from './skills/DiscoverView';
import { RegistryNotice } from './skills/RegistryNotice';
import { useSkillsView, type SkillsTab } from './skills/useSkillsView';

interface Props {
  connected: boolean;
  skills: SkillMeta[];
  loaded: boolean;
  openSkill: SkillDoc | null;
  registry: RegistryCatalog | null;
  registryLoading: boolean;
  registryError: string | null;
  installing: ReadonlySet<string>;
  onSkillList: () => void;
  onSkillOpen: (id: string) => void;
  onSkillClose: () => void;
  onRegistryGet: (refresh?: boolean) => void;
  onRegistryInstall: (key: string, items: RegistryRef[]) => void;
}

export function Skills(p: Props) {
  const { connected, skills, loaded, registry, registryLoading, registryError, onSkillList, onRegistryGet } = p;
  const v = useSkillsView(skills, registry);

  useEffect(() => { if (connected) onSkillList(); }, [connected, onSkillList]);
  useEffect(() => { if (connected && !registry) onRegistryGet(); }, [connected, registry, onRegistryGet]);
  const { stalled, retry } = useLoadStalled(loaded, connected);

  const tabs: { id: SkillsTab; label: string; icon: 'sparkles' | 'layers' | 'search'; count?: number }[] = [
    { id: 'installed', label: 'Instaladas', icon: 'sparkles', count: v.counts.installed },
    { id: 'packs', label: 'Packs', icon: 'layers', count: v.counts.packs },
    { id: 'discover', label: 'Descobrir', icon: 'search', count: v.counts.discover },
  ];
  const registryBlocked = !registry && (registryLoading || registryError);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-neutral-950">
      <RouteHeader variant="bar" title="skills" badge={<Badge tone="neutral">{skills.length}</Badge>}
        actions={<SkillsSearch value={v.query} onChange={v.setQuery} inputRef={v.searchRef} />} />
      {!connected ? (
        <SkillsOffline />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Tabs items={tabs} active={v.tab} onChange={v.setTab} className="overflow-x-auto px-4"
            right={registry && <Button variant="ghost" size="sm" icon="rotate" loading={registryLoading} onClick={() => onRegistryGet(true)}>Registro</Button>} />
          <div className="scroll-thin flex-1 overflow-y-auto p-4">
            {v.tab === 'installed' ? (
              !loaded ? (
                stalled ? (
                  <EmptyState icon="x" title="Não deu pra carregar as skills" description="O servidor não respondeu com a lista. Tente de novo.">
                    <Button icon="rotate" onClick={() => { retry(); onSkillList(); }}>Tentar de novo</Button>
                  </EmptyState>
                ) : <SkeletonCards />
              ) : v.installed.packs.length === 0 && v.installed.groups.length === 0 ? (
                <SkillsEmpty query={v.query} />
              ) : (
                <InstalledView packs={v.installed.packs} groups={v.installed.groups} installing={p.installing} onInstall={p.onRegistryInstall} onOpen={p.onSkillOpen} />
              )
            ) : registryBlocked ? (
              <RegistryNotice loading={registryLoading} error={registryError} onRetry={() => onRegistryGet(true)} />
            ) : v.tab === 'packs' ? (
              <PacksView packs={v.packs} installing={p.installing} onInstall={p.onRegistryInstall} onOpen={p.onSkillOpen} />
            ) : (
              <DiscoverView skills={v.discover} installing={p.installing} onInstall={p.onRegistryInstall} />
            )}
          </div>
        </div>
      )}
      {p.openSkill && <SkillModal doc={p.openSkill} onClose={p.onSkillClose} />}
    </div>
  );
}
