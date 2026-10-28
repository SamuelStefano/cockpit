import type { ReactNode } from 'react';
import { IconButton, Tooltip, type ConnState } from '../../primitives';
import { Bit } from '../../bit/Bit';
import { BIT_STATE_LABEL, type BitState } from '../../bit/bit-state';
import { comboLabel } from '../../../lib/platform';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter, type AccountProps } from './SidebarFooter';
import { FOOTER_NAV, footerNav } from './sidebar-nav';
import { useSidebarCollapsed } from './useSidebarCollapsed';

export interface SidebarProps {
  route: Route;
  nav: (to: Route) => void;
  role: NavRole;
  navCounts?: Partial<Record<Route, number>>;
  onNew: () => void;
  onPalette: () => void;
  bitState: BitState;
  conn: ConnState;
  account: AccountProps;
  // The conversations list (SessionsPanel), shown only when expanded.
  sessions?: ReactNode;
  // Phone drawer: always expanded, fills its container, and the header button closes it.
  drawer?: { onClose: () => void };
}

const SETTINGS_TO = FOOTER_NAV.find((i) => i.id === 'configuracoes')!.to;

export function Sidebar({ route, nav, role, navCounts, onNew, onPalette, bitState, conn, account, sessions, drawer }: SidebarProps) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const expanded = drawer ? true : !collapsed;
  const k = comboLabel(['⌘', 'K']);
  const toggleLabel = drawer ? 'Fechar menu' : expanded ? 'Recolher barra lateral' : 'Expandir barra lateral';
  const list = expanded && sessions;
  return (
    <aside
      aria-label="Navegação principal"
      className={`relative z-30 flex h-full shrink-0 flex-col bg-neutral-950 ${drawer ? 'w-full' : `border-r border-neutral-800 transition-[width] duration-200 ${expanded ? 'w-75' : 'w-14'}`}`}
    >
      <div className={`flex shrink-0 p-2 ${expanded ? 'h-12 items-center gap-0.5' : 'flex-col items-center gap-1'}`}>
        <Tooltip label={`Ir pro chat · ${BIT_STATE_LABEL[bitState]}`} side="right" disabled={!!drawer}>
          <button type="button" onClick={() => nav('/')} aria-label="Ir pro chat" className="flex h-10 items-center gap-2 rounded-lg px-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40">
            <Bit state={bitState} size={30} />
            {expanded && <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">Deck</span>}
          </button>
        </Tooltip>
        {expanded && <span className="flex-1" />}
        {!drawer && <IconButton icon="squarePen" label="Nova conversa" side={expanded ? 'bottom' : 'right'} onClick={onNew} />}
        <IconButton icon="search" label={`Comandos (${k})`} tip={`Buscar · ${k}`} side={expanded ? 'bottom' : 'right'} onClick={onPalette} />
        <IconButton icon="panelLeft" label={toggleLabel} side={expanded ? 'bottom' : 'right'} aria-expanded={expanded} onClick={drawer ? drawer.onClose : toggle} />
      </div>

      {/* Routes sit above the conversations (ChatGPT-style), so the list starts lower and a rule
          separates the two instead of the list running from the top to the account. */}
      <div className="mx-2 shrink-0 pb-2">
        <SidebarNav route={route} nav={nav} role={role} counts={navCounts} expanded={expanded} />
      </div>

      <div className={`flex min-h-0 flex-1 flex-col ${list ? 'mx-2 border-t border-neutral-800/80' : ''}`}>
        {list ? <div className="-mx-2 min-h-0 flex-1">{sessions}</div> : <div className="flex-1" />}
      </div>

      <SidebarFooter expanded={expanded} onSettings={footerNav(role).some((i) => i.id === 'configuracoes') ? () => nav(SETTINGS_TO) : undefined} onDevices={() => { nav('/conexoes'); history.replaceState(null, '', '/conexoes#aparelhos'); window.dispatchEvent(new PopStateEvent('popstate')); }} account={account} conn={conn} role={role} />
    </aside>
  );
}
