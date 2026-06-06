import { useEffect } from 'react';
import { Icon } from '../components/primitives';
import type { AdminHealth } from '../../shared/protocol';

// Painel admin READ-ONLY (DR-007): health da máquina/agente. Sem controle/escrita
// — auth-gate fica p/ depois. Hoje protegido só por loopback.

function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1) + ' GB';
}

function dur(sec: number): string {
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60);
  if (m < 60) return m + 'min';
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}min`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: Parameters<typeof Icon>[0]['name']; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-yellow-400' : 'text-neutral-100';
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-500">
        <Icon name={icon} size={12} /> {label}
      </span>
      <span className={`font-mono text-[20px] font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-red-400'}`} />;
}

export function Admin({ health, onHealthList }: { health: AdminHealth | null; onHealthList: () => void }) {
  useEffect(() => {
    onHealthList();
    const id = setInterval(onHealthList, 10_000);
    return () => clearInterval(id);
  }, [onHealthList]);

  const diskPct = health && health.disk.total > 0 ? Math.round((health.disk.used / health.disk.total) * 100) : 0;

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 flex items-center gap-2">
          <Icon name="check" size={17} className="text-orange-400" />
          <h1 className="text-[17px] font-semibold text-neutral-100">Admin</h1>
        </div>
        <p className="mb-5 text-[12.5px] text-neutral-500">
          Saúde da máquina e do agente — somente leitura. Vínculos (Claude, MCP, SSH) e recursos do host.
        </p>

        {!health ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center text-[12.5px] text-neutral-500">
            Carregando health…
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">Vínculos</h2>
              <ul className="space-y-2 text-[13px]">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-300"><Dot on={health.claudeAuth} /> Conta Claude (CLI)</span>
                  <span className="text-neutral-500">{health.claudeAuth ? 'autenticado' : 'sem credencial'}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-300"><Dot on={health.mcpServers.length > 0} /> Servidores MCP</span>
                  <span className="truncate pl-3 text-right text-neutral-500">{health.mcpServers.length ? health.mcpServers.join(', ') : 'nenhum'}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-300"><Dot on={health.sshKeys > 0} /> Chaves SSH</span>
                  <span className="text-neutral-500">{health.sshKeys} chave(s)</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Disco" value={`${diskPct}%`} icon="zap" tone={diskPct > 90 ? 'warn' : undefined} />
              <Stat label="Livre" value={gb(health.disk.total - health.disk.used)} icon="zap" />
              <Stat label="Uptime backend" value={dur(health.uptimeSec)} icon="check" tone="ok" />
              <Stat label="Node" value={health.node} icon="terminal" />
              <Stat label="Sessões" value={String(health.sessions)} icon="message" />
              <Stat label="Memórias" value={String(health.memories)} icon="file" />
              <Stat label="Skills" value={String(health.skills)} icon="sparkles" />
              <Stat label="Modo" value={health.permissionMode} icon="check" />
            </div>

            <p className="mt-5 text-[11px] text-neutral-600">
              Backend {health.host}:{health.port} · pid {health.pid} · atualiza a cada 10s · loopback-only (sem porta pública até hardening).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
