import type { ReactNode } from 'react';
import { useWidthTransition } from './useWidthTransition';
import { Button, IconButton, Tooltip, type ConnState } from '../../primitives';
import { Bit } from '../../bit/Bit';
import { BIT_STATE_LABEL, type BitState } from '../../bit/bit-state';
import { comboLabel } from '../../../lib/platform';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { SidebarFooter, type AccountProps } from './SidebarFooter';
import { canOpenSettings, sidebarNav } from './sidebar-nav';
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
  // Compact chat tiles, shown only in the collapsed rail between the header and the routes.
  rail?: ReactNode;
  // Phone drawer: always expanded, fills its container, and the header button closes it.
  drawer?: { onClose: () => void };
}

export function Sidebar({ route, nav, role, navCounts, onNew, onPalette, bitState, conn, account, sessions, rail, drawer }: SidebarProps) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const expanded = drawer ? true : !collapsed;
  const animating = useWidthTransition(expanded);
  const k = comboLabel(['⌘', 'K']);
  const toggleLabel = drawer ? 'Fechar menu' : expanded ? 'Recolher barra lateral' : 'Expandir barra lateral';
  const list = expanded && sessions;
  const bitButton = (
    <Tooltip label={`Ir pro chat · ${BIT_STATE_LABEL[bitState]}`} side="right" disabled={!!drawer}>
      <button type="button" onClick={() => nav('/')} aria-label="Ir pro chat" className="bit-greet flex h-11 items-center gap-2 rounded-xl px-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40">
        <Bit state={bitState} size={expanded ? 36 : 30} />
        {expanded && <span className="font-display text-[28px] font-bold lowercase leading-none tracking-wide text-neutral-50">deck</span>}
      </button>
    </Tooltip>
  );
  return (
    <aside
      aria-label="Navegação principal"
      className={`relative z-30 flex h-full shrink-0 flex-col bg-neutral-950 ${drawer ? 'w-full' : `border-r border-neutral-800 transition-[width] duration-200 motion-reduce:transition-none ${expanded ? 'w-75' : 'w-14'} ${animating ? 'overflow-hidden' : ''}`}`}
    >
      <div className={`flex h-full min-h-0 shrink-0 flex-col ${drawer ? 'w-full' : expanded ? 'w-[calc(18.75rem-1px)]' : 'w-[calc(3.5rem-1px)]'}`}>
      <div className={`flex shrink-0 p-2 ${expanded ? 'h-14 items-center gap-0.5' : 'flex-col items-center gap-1'}`}>
        {bitButton}
        {!drawer && !expanded && <IconButton icon="panelLeft" label={toggleLabel} side="right" aria-expanded={expanded} onClick={toggle} />}
        {expanded && <span className="flex-1" />}
        {!drawer && !expanded && <IconButton icon="squarePen" label="Nova conversa" side="right" onClick={onNew} />}
        {!drawer && !expanded && role !== 'student' && <IconButton icon="layers" label="Mesa" side="right" onClick={() => nav('/mesa')} />}
        <IconButton icon="search" label={`Comandos (${k})`} tip={`Buscar · ${k}`} side={expanded ? 'bottom' : 'right'} onClick={onPalette} />
        {(expanded || drawer) && <IconButton icon={drawer ? 'x' : 'panelLeft'} label={drawer ? 'Fechar menu' : toggleLabel} side="bottom" aria-expanded={expanded} onClick={drawer ? drawer.onClose : toggle} />}
      </div>

      {(drawer || expanded) && (
        <div className="flex shrink-0 flex-col gap-1.5 px-2 pb-2">
          <Button icon="plus" onClick={onNew} className="w-full">Nova conversa</Button>
          {role !== 'student' && <Button icon="layers" variant="secondary" onClick={() => nav('/mesa')} className="w-full">Mesa</Button>}
        </div>
      )}

      {!expanded && (rail ?? <div className="flex-1" />)}

      {expanded && <div className={`flex min-h-0 flex-1 flex-col ${list ? 'mx-2 border-t border-neutral-800/80' : ''}`}>
        {list ? <div className="-mx-2 min-h-0 flex-1">{sessions}</div> : <div className="flex-1" />}
      </div>}

      <SidebarFooter routes={sidebarNav(role)} route={route} nav={nav} counts={navCounts} expanded={expanded} onSettings={canOpenSettings(role) ? () => nav('/configuracoes') : undefined} account={account} conn={conn} role={role} />
      </div>
    </aside>
  );
}
