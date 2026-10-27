import { Icon, ConnDot, tokens, type ConnState } from '../primitives';
import { ProfileMenu } from '../ProfileMenu';
import { UsageBar } from './UsageBar';
import { usageChip, type UsageAgent, type UsageReading } from './usage-agent';
import { RouteMenu } from './RouteMenu';
import { navBreakpoint, navFor, type NavRole } from './nav-routes';
import { RoleBadge } from './RoleBadge';
import { NavCount } from './NavCount';
import type { Route } from '../../useRoute';
import type { PlanUsage } from '../../../shared/protocol';
import type { DropApi } from '../../cockpit/useDrops';
import { comboLabel } from '../../lib/platform';
import { Bit } from '../bit/Bit';
import { BIT_STATE_LABEL, type BitState } from '../bit/bit-state';

interface HeaderProps {
  conn: { ws: ConnState; sse: ConnState };
  isMobile: boolean;
  onMenu: () => void;
  menuOpen: boolean;
  route: Route;
  nav: (to: Route) => void;
  onPalette: () => void;
  planUsage: PlanUsage | null;
  // Grok account, shown in the chip when the agent on screen is Grok.
  usageAgent?: UsageAgent;
  grokUsage?: UsageReading;
  onRefreshGrokUsage?: (force?: boolean) => void;
  planBlockedUntil?: number | null;
  planReadAt?: number | null;
  planNextReadAt?: number | null;
  onRefreshPlanUsage?: (force?: boolean) => void;
  quotaWarn?: boolean;
  quotaPaused?: boolean;
  quotaResetsAt?: number | null;
  role: NavRole;
  routeMenuOpen: boolean;
  setRouteMenuOpen: (v: boolean) => void;
  userId?: string;
  onSignOut?: () => void;
  onChangePassword?: (password: string) => Promise<string | null>;
  drops?: DropApi;
  bitState?: BitState;
  navCounts?: Partial<Record<Route, number>>;
}

export function Header({ conn, isMobile, onMenu, menuOpen, route, nav, onPalette, planUsage, planBlockedUntil = null, planReadAt = null, planNextReadAt = null, onRefreshPlanUsage, usageAgent = 'claude', grokUsage, onRefreshGrokUsage, quotaWarn = false, quotaPaused = false, quotaResetsAt = null, role, routeMenuOpen, setRouteMenuOpen, userId, onSignOut, onChangePassword, drops, bitState = 'idle', navCounts }: HeaderProps) {
  const chip = usageChip(usageAgent, { usage: planUsage, blockedUntil: planBlockedUntil, readAt: planReadAt, nextReadAt: planNextReadAt }, grokUsage);
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {isMobile && route === '/' && (
          <button onClick={onMenu} title="Sessões" aria-label="Sessões" aria-expanded={menuOpen} className={`-ml-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 ${tokens.touchBox}`}>
            <Icon name="menu" size={18} />
          </button>
        )}
        {/* Só navega: criar sessão daqui era destrutivo de contexto e o logo fica
            colado no hambúrguer no celular (toque acidental garantido). "Nova
            sessão" segue no drawer, na paleta e no estado vazio do chat. */}
        <button
          onClick={() => nav('/')}
          title={`Ir pro chat · ${BIT_STATE_LABEL[bitState]}`}
          className={`flex items-center gap-2 rounded-md pointer-coarse:min-h-11 ${tokens.focusRing}`}
        >
          <Bit state={bitState} size={30} title={BIT_STATE_LABEL[bitState]} className="-my-1" />
          {/* Em 360–390px o header não fecha a conta com o wordmark e o ConnDot
              (a direita é shrink-0 e sozinha passa de 200px): os dois só voltam
              a partir de sm. O estado "caiu" segue visível no OfflineNotice. */}
          <span className="hidden font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100 transition hover:text-white sm:inline">Deck</span>
        </button>
        <nav className={`ml-1 hidden min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5 ${navBreakpoint(role).strip}`}>
          {navFor(role).map((n) => (
            <button
              key={n.to}
              onClick={() => nav(n.to)}
              className={`rounded-md px-2.5 py-1 font-mono text-[12px] lowercase tracking-tight transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40
                ${route === n.to ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {n.label}
              <NavCount count={navCounts?.[n.to]} />
            </button>
          ))}
        </nav>
        <RouteMenu route={route} nav={nav} role={role} open={routeMenuOpen} setOpen={setRouteMenuOpen} counts={navCounts} />
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
        <UsageBar usage={chip.usage} compact={isMobile} warn={chip.gate && quotaWarn} paused={chip.gate && quotaPaused} quotaResetsAt={chip.gate ? quotaResetsAt : null} blockedUntil={chip.blockedUntil} readAt={chip.readAt} nextReadAt={chip.nextReadAt}
          onRefresh={chip.agent === 'grok' ? onRefreshGrokUsage : onRefreshPlanUsage} agent={chip.agent} secondary={chip.secondary} />
        <button
          onClick={onPalette}
          title={`Comandos (${comboLabel(['⌘', 'K'])})`}
          aria-label={`Comandos (${comboLabel(['⌘', 'K'])})`}
          className={`flex shrink-0 items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 py-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300 ${isMobile ? 'px-2' : 'px-2.5'}`}
        >
          <Icon name="search" size={14} />
          {!isMobile && <kbd className="font-mono text-[12px] text-neutral-600">{comboLabel(['⌘', 'K'])}</kbd>}
        </button>
        <div className={`hidden shrink-0 items-center rounded-lg border border-neutral-800 bg-neutral-900/60 py-1 sm:flex ${isMobile ? 'px-2' : 'px-2.5'}`}>
          <ConnDot label="ws" state={conn.ws} compact={isMobile} />
        </div>
        <RoleBadge role={role} />
        <ProfileMenu userId={userId} onSignOut={onSignOut} onChangePassword={onChangePassword} drops={drops} />
      </div>
    </header>
  );
}
