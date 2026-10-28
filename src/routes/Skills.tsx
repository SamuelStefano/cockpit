import { useEffect, useState } from 'react';
import { Badge, Button, EmptyState, IconButton, SkeletonCards, Tabs } from '../components/primitives';
import { useIsMobile } from '../app/useIsMobile';
import { TopBarAction } from '../components/chrome/sidebar/TopBarSlot';
import { useLoadStalled } from '../lib/useLoadStalled';
import type { RegistryCatalog, RegistryRef, SkillMeta, TeamBot } from '../../shared/protocol';
import type { SkillDoc } from '../useCockpit';
import { botWithSkillToggled } from './skills/toggle-agent';
import { SkillPage } from './skills/SkillPage';
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
}

export function Skills(p: Props) {
  const { connected, skills, loaded, registry, registryLoading, registryError, skillId, onSkillList, onSkillOpen, onSkillClose, onRegistryGet } = p;
  const v = useSkillsView(skills, registry);
  const phone = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const showSearch = searchOpen || v.query !== '';

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
            <SkillPage skill={skills.find((s) => s.id === skillId)} doc={p.openSkill} skillId={skillId} bots={p.bots} loaded={loaded} onBack={() => p.onNavigate('')}
              onToggleAgent={p.onToggleAgent && ((sid, botId, on) => { const b = p.bots.find((x) => x.id === botId); if (b) p.onToggleAgent?.(botWithSkillToggled(b, skills, sid, on)); })} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-neutral-950">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-5 max-lg:hidden md:px-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-neutral-100">Skills</h1>
        <Badge tone="neutral">{skills.length}</Badge>
        <p className="text-[13px] text-neutral-500">O que cada agente sabe fazer. Ligue por agente na página dele.</p>
        {!phone && <div className="ml-auto"><SkillsSearch value={v.query} onChange={v.setQuery} inputRef={v.searchRef} /></div>}
      </header>
      <TopBarAction>
        <IconButton icon="search" label="Filtrar skills" side="bottom" aria-pressed={showSearch} onClick={() => setSearchOpen((o) => !o)} className="pointer-coarse:h-11 pointer-coarse:w-11" />
      </TopBarAction>
      {phone && showSearch && <div className="shrink-0 px-4 pt-1"><SkillsSearch value={v.query} onChange={v.setQuery} inputRef={v.searchRef} /></div>}
      {!connected ? (
        <SkillsOffline />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Tabs items={tabs} active={v.tab} onChange={v.setTab} className="mt-2 overflow-x-auto px-4 lg:mt-3" compact
            right={registry && <Button variant="ghost" size="sm" icon="rotate" loading={registryLoading} onClick={() => onRegistryGet(true)}
              aria-label="Atualizar o registro" title="Atualizar o registro" className="max-sm:w-7 max-sm:gap-0 max-sm:px-0"><span className="max-sm:sr-only">Registro</span></Button>} />
          <div className="scroll-thin flex-1 overflow-y-auto p-4">
            <div className="mx-auto w-full max-w-240">
              {v.tab === 'installed' ? (
                !loaded ? (
                  stalled ? (
                    <EmptyState size="sm" icon="x" title="Não deu pra carregar as skills" description="O servidor não respondeu com a lista. Tente de novo.">
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
