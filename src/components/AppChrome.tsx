import { useEffect, useRef, useState } from 'react';
import { Icon, ConnDot, type ConnState } from './primitives';
import { ProfileMenu } from './Avatar';
import { VpsConnectForm } from './VpsConnectForm';
import type { Route } from '../useRoute';
import type { PlanUsage } from '../../shared/protocol';

// --- UsageBar --------------------------------------------------------------

// Uso GLOBAL do plano (claude.ai/settings/usage), não contexto de chat: a % da
// quota de prompts já consumida na janela de 5h. Sempre à vista no header.
function fmtReset(ms: number | null): string {
  if (!ms) return '';
  const mins = Math.max(0, Math.round((ms - Date.now()) / 60000));
  if (mins <= 0) return 'em instantes';
  if (mins < 60) return `em ${mins}min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `em ${h}h${m}min` : `em ${h}h`;
}

export function UsageBar({ usage, compact }: { usage: PlanUsage | null; compact: boolean }) {
  if (!usage) return null;
  const pct = usage.fiveHour;
  const high = pct >= 90, mid = pct >= 70;
  const bar = high ? 'bg-red-500' : mid ? 'bg-amber-500' : 'bg-emerald-500';
  const text = high ? 'text-red-300' : mid ? 'text-amber-300' : 'text-emerald-300';
  const reset = fmtReset(usage.resetsAt);
  return (
    <div
      title={`Uso do plano: ${pct}% da janela de 5h consumida${reset ? ` · reseta ${reset}` : ''} · 7 dias: ${usage.sevenDay}%`}
      className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Usage</span>
      <div className={`${compact ? 'w-16' : 'w-24'} h-2 overflow-hidden rounded-full bg-neutral-800`}>
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-medium tabular-nums ${text}`}>{pct}%</span>
    </div>
  );
}

// --- Header ----------------------------------------------------------------

interface HeaderProps {
  conn: { ws: ConnState; sse: ConnState };
  isMobile: boolean;
  onMenu: () => void;
  route: Route;
  nav: (to: Route) => void;
  onPalette: () => void;
  planUsage: PlanUsage | null;
  onNew: () => void;
}

const NAV: { to: Route; label: string }[] = [
  { to: '/', label: 'chat' },
  { to: '/contextos', label: 'contextos' },
  { to: '/skills', label: 'skills' },
  { to: '/uso', label: 'uso' },
  { to: '/admin', label: 'admin' },
  { to: '/docs', label: 'docs' },
];

// Em telas estreitas as 6 abas não cabem no header (eram cortadas). Aqui viram um
// dropdown compacto que mostra a rota atual e abre a lista ao toque.
function RouteMenu({ route, nav }: { route: Route; nav: (to: Route) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const current = NAV.find((n) => n.to === route) ?? NAV[0];
  return (
    <div ref={wrapRef} className="relative md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 font-mono text-[11.5px] lowercase tracking-tight text-orange-300"
      >
        {current.label}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-2xl">
          {NAV.map((n) => (
            <button
              key={n.to}
              onClick={() => { nav(n.to); setOpen(false); }}
              className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left font-mono text-[12px] lowercase tracking-tight transition
                ${route === n.to ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
            >
              {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header({ conn, isMobile, onMenu, route, nav, onPalette, planUsage, onNew }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-3">
      <div className="flex items-center gap-2.5">
        {isMobile && (
          <button onClick={onMenu} className="-ml-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
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
        <RouteMenu route={route} nav={nav} />
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <UsageBar usage={planUsage} compact={isMobile} />
        </div>
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
        <ProfileMenu />
      </div>
    </header>
  );
}

// --- AuthGate --------------------------------------------------------------

// Tela de login (DR-011 Fase 2). Só aparece quando o servidor exige token
// (COCKPIT_TOKEN setado) e o nosso falta/está errado — o WS volta com close 4401.
// Single-account: o token É a identidade. Fica salvo no navegador; sem servidor
// de sessão. Substitui o app inteiro até a conexão autenticar.
export function AuthGate({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [token, setToken] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (token.trim()) onSubmit(token); };
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-neutral-950 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-neutral-950 shadow-[0_0_12px_-1px_rgba(249,115,22,0.55)]">
            <Icon name="terminal" size={16} stroke={2.4} />
          </span>
          <div>
            <div className="font-mono text-[15px] font-semibold lowercase tracking-tight text-neutral-100">deck</div>
            <div className="text-[11px] text-neutral-500">acesso restrito</div>
          </div>
        </div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <Icon name="shield" size={12} /> Token de acesso
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
          placeholder="cole o token do servidor"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-none transition focus:border-orange-500/40"
        />
        <button
          type="submit"
          disabled={!token.trim()}
          className="mt-3 w-full rounded-lg bg-orange-500 px-3 py-2 text-[13px] font-medium text-neutral-950 transition hover:bg-orange-400 disabled:opacity-50"
        >
          Entrar
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
          Este Deck controla a VPS. O token vem da variável <span className="font-mono text-neutral-500">COCKPIT_TOKEN</span> do servidor
          e fica salvo só neste navegador.
        </p>
        <button
          type="button"
          onClick={() => setShowConnect((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-500 transition hover:text-neutral-300"
        >
          <Icon name={showConnect ? 'chevronDown' : 'chevronRight'} size={12} /> Configurar endereço do backend
        </button>
        {showConnect && (
          <div className="mt-3 border-t border-neutral-800 pt-3">
            <VpsConnectForm />
          </div>
        )}
      </form>
    </div>
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
  const [showConnect, setShowConnect] = useState(false);
  if (!show) return null;
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-[58px] z-40 w-[min(92vw,30rem)] -translate-x-1/2">
      <div className="pointer-events-auto rounded-lg border border-red-500/30 bg-red-500/[0.12] px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-md">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-400">
            <Icon name="circle" size={13} />
          </span>
          <div className="leading-tight">
            <p className="text-[12px] font-medium text-red-200">Backend não acessível</p>
            <p className="text-[11px] text-red-200/70">
              O Deck não alcança o servidor em <span className="font-mono">{location.host}</span>. Confira se o backend está rodando (ou o túnel/Tailscale). Tentando reconectar…
            </p>
            <button
              type="button"
              onClick={() => setShowConnect((v) => !v)}
              className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-red-200/80 transition hover:text-red-100"
            >
              <Icon name={showConnect ? 'chevronDown' : 'chevronRight'} size={12} /> Configurar endereço do backend
            </button>
          </div>
        </div>
        {showConnect && (
          <div className="mt-3 border-t border-red-500/20 pt-3">
            <VpsConnectForm />
          </div>
        )}
      </div>
    </div>
  );
}
