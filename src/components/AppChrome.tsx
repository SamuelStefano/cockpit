import { Icon, ConnDot, type ConnState } from './primitives';
import { ProfileMenu } from './Avatar';
import type { Route } from '../useRoute';

// --- Header ----------------------------------------------------------------

interface HeaderProps {
  conn: { ws: ConnState; sse: ConnState };
  onNew: () => void;
  isMobile: boolean;
  onMenu: () => void;
  route: Route;
  nav: (to: Route) => void;
  onPalette: () => void;
}

const NAV: { to: Route; label: string }[] = [
  { to: '/', label: 'chat' },
  { to: '/contextos', label: 'contextos' },
  { to: '/skills', label: 'skills' },
  { to: '/uso', label: 'uso' },
  { to: '/admin', label: 'admin' },
];

export function Header({ conn, onNew, isMobile, onMenu, route, nav, onPalette }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-3">
      <div className="flex items-center gap-2.5">
        {isMobile && (
          <button onClick={onMenu} className="-ml-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
            <Icon name="menu" size={18} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500 text-neutral-950 shadow-[0_0_12px_-1px_rgba(249,115,22,0.55)]">
            <Icon name="terminal" size={14} stroke={2.4} />
          </span>
          <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">cockpit</span>
        </div>
        <nav className="ml-1 flex items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5">
          {NAV.map((n) => (
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
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onPalette}
          title="Comandos (⌘K)"
          className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
        >
          <Icon name="search" size={14} />
          {!isMobile && <kbd className="font-mono text-[10px] text-neutral-600">⌘K</kbd>}
        </button>
        <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1">
          <ConnDot label="ws" state={conn.ws} compact={isMobile} />
        </div>
        {!isMobile && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[12.5px] font-semibold text-neutral-950 transition hover:bg-orange-400"
          >
            <Icon name="plus" size={15} stroke={2.4} /> Nova sessão
          </button>
        )}
        <ProfileMenu />
      </div>
    </header>
  );
}

// --- QuotaBanner -----------------------------------------------------------

interface QuotaBannerProps {
  onClose: () => void;
  reset: string;
}

export function QuotaBanner({ onClose, reset }: QuotaBannerProps) {
  return (
    <div className="fade-up pointer-events-none absolute bottom-3 right-3 z-30 max-w-[calc(100vw-1.5rem)]">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-yellow-500/20 bg-neutral-900/85 py-1 pl-2 pr-1 text-yellow-200/80 shadow-lg shadow-black/30 backdrop-blur-md transition hover:border-yellow-500/40 hover:text-yellow-200">
        <Icon name="zap" size={12} className="shrink-0 text-yellow-400/80" />
        <span className="truncate text-[11px]">Uso próximo do limite · reseta {reset}</span>
        <button onClick={onClose} title="Dispensar" className="shrink-0 rounded-full p-0.5 text-yellow-200/40 transition hover:bg-yellow-500/10 hover:text-yellow-200">
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>
  );
}

// Rail fino que ocupa o lugar de um painel recolhido — clicar reexpande.
export function CollapsedRail({ side, label, icon, onExpand }: {
  side: 'left' | 'right'; label: string; icon: Parameters<typeof Icon>[0]['name']; onExpand: () => void;
}) {
  return (
    <button
      onClick={onExpand}
      title={`Mostrar ${label}`}
      className={`group flex w-9 shrink-0 flex-col items-center gap-2 bg-neutral-950 py-3 text-neutral-500 transition hover:bg-neutral-900 hover:text-neutral-200 ${side === 'left' ? 'border-r' : 'border-l'} border-neutral-800`}
    >
      <Icon name={side === 'left' ? 'chevronRight' : 'chevronLeft'} size={15} />
      <Icon name={icon} size={14} className="text-neutral-600 group-hover:text-orange-400" />
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-600 [writing-mode:vertical-rl]">{label}</span>
    </button>
  );
}

// Botão de recolher ancorado no canto superior-direito (área vazia em ambos os
// painéis). A seta aponta pra fora — esquerda recolhe à esquerda, direita à direita.
export function CollapseBtn({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Recolher painel"
      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900/80 text-neutral-500 backdrop-blur transition hover:border-neutral-700 hover:text-neutral-200"
    >
      <Icon name={side === 'left' ? 'chevronLeft' : 'chevronRight'} size={14} />
    </button>
  );
}

// Aviso honesto quando o backend não responde por alguns segundos (caso clássico:
// front no Vercel sem túnel pro backend loopback). Evita a sensação de "app quebrado".
export function OfflineNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-[58px] z-40 w-[min(92vw,30rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/[0.12] px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-md">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-400">
          <Icon name="circle" size={13} />
        </span>
        <div className="leading-tight">
          <p className="text-[12px] font-medium text-red-200">Backend não acessível</p>
          <p className="text-[11px] text-red-200/70">
            O cockpit não alcança o servidor em <span className="font-mono">{location.host}</span>. Confira se o backend está rodando (ou o túnel/Tailscale). Tentando reconectar…
          </p>
        </div>
      </div>
    </div>
  );
}
