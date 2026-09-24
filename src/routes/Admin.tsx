import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, RouteHeader, toast } from '../components/primitives';
import type { AdminHealth, SysStats, AccountSummary } from '../../shared/protocol';
import { AdminAccounts } from './AdminAccounts';
import { AdminHostOps } from './AdminHostOps';
import { AdminDeckUpdate } from './AdminDeckUpdate';
import { AdminInventory } from './AdminInventory';
import { AdminTabs, type AdminTab } from './AdminTabs';
import { AdminHealthSkeleton } from './AdminHealthSkeleton';
import { Stat } from './adminPrimitives';
import { gb, clockTime, dur } from './adminFormat';
import { SUPABASE_ENABLED } from '../lib/supabase';

// Painel admin: health/inventário da máquina (somente leitura) + controle de host
// (tokens, MCP, CLI) e contas, ambos gated por role admin no relay. Organizado em
// sub-abas; ações sensíveis pedem confirmação. Loopback continua sem porta pública.

interface AdminProps {
  health: AdminHealth | null;
  stats: SysStats | null;
  onHealthList: () => void;
  accounts: AccountSummary[];
  accountsLoaded: boolean;
  onAccountsList: () => void;
  onSetAdmin: (accountId: string, admin: boolean) => void;
  isRoot: boolean; // só root concede/revoga admin
  adminOp: { ok: boolean; message: string } | null;
  onEnvSet: (name: string, value: string) => boolean;
  onEnvUnset: (name: string) => void;
  onMcpAdd: (name: string, opts: { command?: string; url?: string }) => void;
  onMcpRemove: (name: string) => void;
  onCliInstall: (name: string) => void;
  onCliUpdate: () => void;
  onDeckRestart: (mode: 'idle' | 'now') => void;
}

const toastedOps = new WeakSet<object>();

export function Admin({ health, stats, onHealthList, accounts, accountsLoaded, onAccountsList, onSetAdmin, isRoot, adminOp, onEnvSet, onEnvUnset, onMcpAdd, onMcpRemove, onCliInstall, onCliUpdate, onDeckRestart }: AdminProps) {
  const [updatedAt, setUpdatedAt] = useState(0);
  const [tab, setTab] = useState('overview');
  // Polls only while the tab is visible (health spawns probes server-side every
  // 10s), and refreshes at once when it comes back.
  useEffect(() => {
    onHealthList();
    const id = setInterval(() => { if (!document.hidden) onHealthList(); }, 10_000);
    const onVisible = () => { if (!document.hidden) onHealthList(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [onHealthList]);
  useEffect(() => { if (health) setUpdatedAt(Date.now()); }, [health]);
  // O resultado da op é do painel inteiro, não só da aba Host: conceder/remover admin
  // na aba Contas não dava sinal nenhum (nem sucesso, nem recusa do relay).
  // adminOp lives in app state for 4–8s: leaving /admin and coming back inside
  // that window re-mounted this effect and toasted the same result again.
  useEffect(() => {
    if (!adminOp || toastedOps.has(adminOp)) return;
    toastedOps.add(adminOp);
    toast(adminOp.message, { tone: adminOp.ok ? 'ok' : 'error' });
  }, [adminOp]);
  // …e a lista de contas não reflete a mudança sozinha.
  useEffect(() => { if (adminOp?.ok && tab === 'accounts') onAccountsList(); }, [adminOp, tab, onAccountsList]);

  const tabs = useMemo<AdminTab[]>(() => {
    const t: AdminTab[] = [{ id: 'overview', label: 'Visão geral', icon: 'zap' }];
    if (SUPABASE_ENABLED) t.push({ id: 'accounts', label: 'Contas', icon: 'user' });
    t.push({ id: 'host', label: 'Host', icon: 'terminal' });
    return t;
  }, []);

  const diskPct = health && health.disk.total > 0 ? Math.round((health.disk.used / health.disk.total) * 100) : 0;
  const memPct = stats && stats.mem.total > 0 ? Math.round((stats.mem.used / stats.mem.total) * 100) : 0;
  const cpuPct = stats ? Math.round(stats.cpu) : 0;
  const gpuPct = stats?.gpu ? Math.round(stats.gpu.util) : null;
  const saturated = !!stats?.saturated && (stats.saturated.cpu || stats.saturated.mem);

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <RouteHeader
          variant="page"
          title="Admin"
          icon="shield"
          subtitle="Saúde e inventário da VPS, controle do host e contas. Ações sensíveis pedem confirmação e exigem role admin no relay."
          actions={
            <Button variant="secondary" size="sm" icon="rotate" title="Atualizar agora" onClick={onHealthList}>
              Atualizar
            </Button>
          }
        />

        <AdminTabs tabs={tabs} active={tab} onSelect={setTab} />

        {tab === 'accounts' && SUPABASE_ENABLED && (
          <AdminAccounts accounts={accounts} loaded={accountsLoaded} onAccountsList={onAccountsList} onSetAdmin={onSetAdmin} canGrant={isRoot} />
        )}

        {tab === 'host' && (
          <AdminDeckUpdate health={health} adminOp={adminOp} onCliUpdate={onCliUpdate} onDeckRestart={onDeckRestart} />
        )}
        {tab === 'host' && (
          <AdminHostOps
            health={health} adminOp={adminOp}
            onEnvSet={onEnvSet} onEnvUnset={onEnvUnset}
            onMcpAdd={onMcpAdd} onMcpRemove={onMcpRemove} onCliInstall={onCliInstall}
          />
        )}

        {tab === 'overview' && (
          <>
            {saturated && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-[12.5px] text-yellow-200">
                <Icon name="zap" size={14} />
                Recursos saturados há {dur(stats!.saturated!.seconds)}
                {stats!.saturated!.cpu ? ' · CPU' : ''}{stats!.saturated!.mem ? ' · RAM' : ''} — só alerta, nenhuma sessão é tocada.
              </div>
            )}

            {stats && (
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="CPU" value={`${cpuPct}%`} icon="zap" tone={cpuPct >= 85 ? 'warn' : cpuPct < 60 ? 'ok' : undefined} />
                <Stat label="RAM" value={`${memPct}%`} icon="layers" tone={memPct >= 85 ? 'warn' : memPct < 60 ? 'ok' : undefined} />
                <Stat label="Load" value={stats.load.toFixed(2)} icon="sliders" />
                <Stat label="GPU" value={gpuPct === null ? '—' : `${gpuPct}%`} icon="monitor" tone={gpuPct !== null && gpuPct >= 85 ? 'warn' : undefined} />
              </div>
            )}

            {!health ? (
              <AdminHealthSkeleton />
            ) : (
              <>
                <AdminInventory health={health} />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Disco" value={`${diskPct}%`} icon="file" tone={diskPct > 90 ? 'warn' : undefined} />
                  <Stat label="Livre" value={gb(health.disk.total - health.disk.used)} icon="download" />
                  <Stat label="Uptime backend" value={dur(health.uptimeSec)} icon="clock" tone="ok" />
                  <Stat label="Node" value={health.node} icon="terminal" />
                  <Stat label="Sessões" value={String(health.sessions)} icon="message" />
                  <Stat label="Memórias" value={String(health.memories)} icon="file" />
                  <Stat label="Skills" value={String(health.skills)} icon="sparkles" />
                  <Stat label="Modo" value={health.permissionMode} icon="shield" />
                </div>

                <p className="mt-5 text-[11px] text-neutral-600">
                  Backend {health.host}:{health.port} · pid {health.pid} · {updatedAt ? `atualizado ${clockTime(updatedAt)}` : 'atualiza a cada 10s'} · loopback-only (sem porta pública até hardening).
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
