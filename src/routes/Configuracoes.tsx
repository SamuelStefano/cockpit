import { useEffect } from 'react';
import { Icon } from '../components/primitives';
import type { NavRole } from '../components/chrome/nav-routes';
import type { UsageDockProps } from '../components/chrome/sidebar/UsageDock';
import type { Route } from '../useRoute';
import type { useCockpit } from '../useCockpit';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { Conta, type AccountProps } from './configuracoes/Conta';
import { Uso } from './configuracoes/Uso';
import { Pessoas } from './configuracoes/Pessoas';
import { Maquina } from './configuracoes/Maquina';
import { Avancado } from './configuracoes/Avancado';
import { SECTION_ROUTE, sectionOf, settingsSections } from './configuracoes/sections';

interface ConfiguracoesProps {
  route: Route;
  role: NavRole;
  nav: (to: Route) => void;
  isMobile: boolean;
  connected: boolean;
  cockpit: ReturnType<typeof useCockpit>;
  account: AccountProps;
  usageDock: UsageDockProps;
  onOpenSession: (id: string) => void;
  onOpenTerminal: () => void;
}

export function Configuracoes({ route, role, nav, isMobile, connected, cockpit: c, account, usageDock, onOpenSession, onOpenTerminal }: ConfiguracoesProps) {
  const items = settingsSections(role, SUPABASE_ENABLED);
  const wanted = sectionOf(route);
  const allowed = items.some((i) => i.id === wanted);
  const section = allowed ? wanted : 'conta';
  useEffect(() => { if (!allowed) nav(SECTION_ROUTE.conta); }, [allowed, nav]);
  const isRoot = role === 'root';

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 px-4 py-5 md:flex-row md:gap-8 md:px-8 md:py-7">
        {items.length > 1 && (
          <nav aria-label="Seções de configurações" className="scroll-thin flex shrink-0 gap-1 overflow-x-auto md:w-44 md:flex-col md:overflow-visible">
            {items.map((i) => (
              <button
                key={i.id} type="button" aria-current={i.id === section ? 'page' : undefined} onClick={() => nav(SECTION_ROUTE[i.id])}
                className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${i.id === section ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}
              >
                <Icon name={i.icon} size={14} />{i.label}
              </button>
            ))}
          </nav>
        )}
        <div className="min-w-0 flex-1">
          {section === 'conta' && <Conta account={account} role={role} />}
          {section === 'uso' && (
            <Uso dock={usageDock} connected={connected} usageStats={c.usageStats} onUsageList={c.onUsageList} sessions={c.sessions} rate={c.rate} onOpenSession={onOpenSession} />
          )}
          {section === 'pessoas' && (
            <Pessoas accounts={c.accounts} loaded={c.accountsLoaded} onAccountsList={c.onAccountsList} onSetAdmin={c.onSetAdmin} adminOp={c.adminOp} />
          )}
          {section === 'maquina' && (
            <Maquina
              stats={c.stats} health={c.health} onHealthList={c.onHealthList} isRoot={isRoot} adminOp={c.adminOp}
              onEnvSet={c.onEnvSet} onEnvUnset={c.onEnvUnset} onMcpAdd={c.onMcpAdd} onMcpRemove={c.onMcpRemove}
              onCliInstall={c.onCliInstall} onCliUpdate={c.onCliUpdate} onDeckRestart={c.onDeckRestart}
            />
          )}
          {section === 'avancado' && (
            <Avancado
              caps={c.caps} bypass={c.bypass} setBypass={c.setBypass} isRoot={isRoot} isMobile={isMobile} adminOp={c.adminOp}
              onCliUpdate={c.onCliUpdate} onDeckRestart={c.onDeckRestart} onOpenTerminal={onOpenTerminal}
            />
          )}
        </div>
      </div>
    </div>
  );
}
