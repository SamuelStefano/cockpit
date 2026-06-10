import { useEffect, useMemo, useState } from 'react';
import { Button, Icon } from '../components/primitives';
import type { AdminHealth, SysStats, AccountSummary } from '../../shared/protocol';
import { AdminAccounts } from './AdminAccounts';
import { AdminHostOps } from './AdminHostOps';
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
  onAccountsList: () => void;
  onSetAdmin: (accountId: string, admin: boolean) => void;
  isRoot: boolean; // só root concede/revoga admin
  adminOp: { ok: boolean; message: string } | null;
  onEnvSet: (name: string, value: string) => void;
  onEnvUnset: (name: string) => void;
  onMcpAdd: (name: string, opts: { command?: string; url?: string }) => void;
  onMcpRemove: (name: string) => void;
  onCliInstall: (name: string) => void;
}

export function Admin({ health, stats, onHealthList, accounts, onAccountsList, onSetAdmin, isRoot, adminOp, onEnvSet, onEnvUnset, onMcpAdd, onMcpRemove, onCliInstall }: AdminProps) {
  const [updatedAt, setUpdatedAt] = useState(0);
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    onHealthList();
    const id = setInterval(onHealthList, 10_000);
    return () => clearInterval(id);
  }, [onHealthList]);
  useEffect(() => { if (health) setUpdatedAt(Date.now()); }, [health]);

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
        <div className="mb-1 flex items-center gap-2">
          <Icon name="shield" size={17} className="text-orange-400" />
          <h1 className="text-[17px] font-semibold text-neutral-100">Admin</h1>
          <Button variant="secondary" size="sm" icon="rotate" title="Atualizar agora" className="ml-auto" onClick={onHealthList}>
            Atualizar
          </Button>
        </div>
        <p className="mb-5 text-[12.5px] text-neutral-500">
          Saúde e inventário da VPS, controle do host e contas. Ações sensíveis pedem confirmação e exigem role admin no relay.
        </p>

        <AdminTabs tabs={tabs} active={tab} onSelect={setTab} />

        {tab === 'accounts' && SUPABASE_ENABLED && (
          <AdminAccounts accounts={accounts} onAccountsList={onAccountsList} onSetAdmin={onSetAdmin} canGrant={isRoot} />
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
                <Stat label="RAM" value={`${memPct}%`} icon="zap" tone={memPct >= 85 ? 'warn' : memPct < 60 ? 'ok' : undefined} />
                <Stat label="Load" value={stats.load.toFixed(2)} icon="zap" />
                <Stat label="GPU" value={gpuPct === null ? '—' : `${gpuPct}%`} icon="zap" tone={gpuPct !== null && gpuPct >= 85 ? 'warn' : undefined} />
              </div>
            )}

            {!health ? (
              <AdminHealthSkeleton />
            ) : (
              <>
                <AdminInventory health={health} />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Disco" value={`${diskPct}%`} icon="zap" tone={diskPct > 90 ? 'warn' : undefined} />
                  <Stat label="Livre" value={gb(health.disk.total - health.disk.used)} icon="zap" />
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
