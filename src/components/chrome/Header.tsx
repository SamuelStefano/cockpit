import { Icon, ConnDot, type ConnState } from '../primitives';
import { ProfileMenu } from '../ProfileMenu';
import { UsageBar } from './UsageBar';
import { RouteMenu } from './RouteMenu';
import { navFor } from './nav-routes';
import type { Route } from '../../useRoute';
import type { PlanUsage } from '../../../shared/protocol';

interface HeaderProps {
  conn: { ws: ConnState; sse: ConnState };
  isMobile: boolean;
  onMenu: () => void;
  route: Route;
  nav: (to: Route) => void;
  onPalette: () => void;
  planUsage: PlanUsage | null;
  onNew: () => void;
  isAdmin: boolean;
  routeMenuOpen: boolean;
  setRouteMenuOpen: (v: boolean) => void;
  userId?: string;
  onSignOut?: () => void;
}

export function Header({ conn, isMobile, onMenu, route, nav, onPalette, planUsage, onNew, isAdmin, routeMenuOpen, setRouteMenuOpen, userId, onSignOut }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-3">
      <div className="flex items-center gap-2.5">
        {isMobile && route === '/' && (
          <button onClick={onMenu} title="Sessões" aria-label="Abrir sessões" className="-ml-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
            <Icon name="menu" size={18} />
          </button>
        )}
        <button
          onClick={() => { nav('/'); onNew(); }}
          title="Nova conversa"
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500 text-neutral-950 shadow-[0_0_12px_-1px_rgba(249,115,22,0.55)]">
            <Icon name="terminal" size={14} stroke={2.4} />
          </span>
          <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100 transition hover:text-white">Deck</span>
        </button>
        <nav className="ml-1 hidden items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5 md:flex">
          {navFor(isAdmin).map((n) => (
            <button
              key={n.to}
              onClick={() => nav(n.to)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11.5px] lowercase tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
                ${route === n.to ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <RouteMenu route={route} nav={nav} isAdmin={isAdmin} open={routeMenuOpen} setOpen={setRouteMenuOpen} />
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
        <UsageBar usage={planUsage} compact={isMobile} />
        <button
          onClick={onPalette}
          title="Comandos (⌘K)"
          aria-label="Comandos (⌘K)"
          className={`flex shrink-0 items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 py-1.5 text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300 ${isMobile ? 'px-2' : 'px-2.5'}`}
        >
          <Icon name="search" size={14} />
          {!isMobile && <kbd className="font-mono text-[10px] text-neutral-600">⌘K</kbd>}
        </button>
        <div className={`flex shrink-0 items-center rounded-lg border border-neutral-800 bg-neutral-900/60 py-1 ${isMobile ? 'px-2' : 'px-2.5'}`}>
          <ConnDot label="ws" state={conn.ws} compact={isMobile} />
        </div>
        <ProfileMenu userId={userId} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
