import { useEffect, type ReactNode } from 'react';
import { Icon, SideNav } from '../components/primitives';
import type { NavRole } from '../components/chrome/nav-routes';
import type { UsageDockProps } from '../components/chrome/sidebar/UsageDock';
import type { Route } from '../useRoute';
import type { useCockpit } from '../useCockpit';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { Conta, type AccountProps } from './configuracoes/Conta';
import { Uso } from './configuracoes/Uso';
import { Pessoas } from './configuracoes/Pessoas';
import { Maquina } from './configuracoes/Maquina';
import { Maquinas } from './configuracoes/Maquinas';
import { Avancado } from './configuracoes/Avancado';
import { SECTION_ROUTE, sectionOf, settingsSections } from './configuracoes/sections';
import { SettingsCard } from './configuracoes/SettingsCard';
import { useSettingsMobileNav } from './configuracoes/useSettingsMobileNav';

// Skills, Conexões and Docs need a lot of cockpit state: the app shell builds them and passes them in.
export interface SettingsPages { skills?: ReactNode; conexoes?: ReactNode; docs?: ReactNode }

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
  pages?: SettingsPages;
}

export function Configuracoes({ route, role, nav, isMobile, connected, cockpit: c, account, usageDock, onOpenSession, onOpenTerminal, pages }: ConfiguracoesProps) {
  const items = settingsSections(role, SUPABASE_ENABLED);
  const wanted = sectionOf(route);
  const allowed = items.some((i) => i.id === wanted);
  const section = allowed ? wanted : 'conta';
  useEffect(() => { if (!allowed) nav(SECTION_ROUTE.conta); }, [allowed, nav]);
  const isRoot = role === 'root';
  const m = useSettingsMobileNav({ isMobile, count: items.length, initiallyOpen: section !== 'conta' });
  const title = items.find((i) => i.id === section)?.label;
  const select = (id: typeof section) => { m.select(); nav(SECTION_ROUTE[id]); };
  const page = (node: ReactNode) => node && <SettingsCard flush className="[&>*]:min-w-0">{node}</SettingsCard>;

  if (m.showList) {
    return (
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <SideNav layout="list" label="Seções de configurações" items={items} active={section} onSelect={select} />
      </div>
    );
  }

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 px-4 py-5 max-lg:pt-1 md:flex-row md:items-start md:gap-6 md:px-8 md:py-7">
        {items.length > 1 && !isMobile && (
          <SideNav label="Seções de configurações" items={items} active={section} onSelect={select} className="md:w-[220px]" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {m.showBack && (
            <button type="button" onClick={m.back} className="-ml-1 flex h-10 w-fit items-center gap-1 rounded-lg px-1 text-[13px] text-neutral-400 hover:text-neutral-100">
              <Icon name="chevronLeft" size={16} />Configurações
            </button>
          )}
          {title && <h1 className="text-[22px] font-semibold tracking-tight text-neutral-100">{title}</h1>}
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
              claudeAccount={c.claudeAccount} claudeLogin={c.claudeLogin} onClaudeAccountGet={c.onClaudeAccountGet} onClaudeLogout={c.onClaudeLogout}
              onClaudeLoginStart={c.onClaudeLoginStart} onClaudeLoginCode={c.onClaudeLoginCode} onClaudeLoginCancel={c.onClaudeLoginCancel}
            />
          )}
          {section === 'maquinas' && <Maquinas userId={account.userId} />}
          {section === 'skills' && page(pages?.skills)}
          {section === 'conexoes' && page(pages?.conexoes)}
          {section === 'docs' && page(pages?.docs)}
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
