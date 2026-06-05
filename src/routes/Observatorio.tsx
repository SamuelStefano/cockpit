import { useEffect, useMemo } from 'react';
import { Icon, Badge } from '../components/primitives';
import type { UsageStats, DailyUsage } from '../../shared/protocol';
import type { Session } from '../data/mock';

const CTX_WINDOW = 200_000; // janela de contexto aproximada (fill %)

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function usd(n: number): string {
  if (n >= 100) return '$' + n.toFixed(0);
  if (n >= 1) return '$' + n.toFixed(2);
  if (n > 0) return '$' + n.toFixed(3);
  return '$0';
}

function rel(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-500">
        <Icon name={icon} size={12} /> {label}
      </span>
      <span className="font-mono text-[22px] font-semibold text-neutral-100">{value}</span>
    </div>
  );
}

function Offline() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        <Icon name="circle" size={20} />
      </div>
      <p className="text-[13px] font-medium text-neutral-300">Backend local indisponível</p>
      <p className="mt-1 max-w-sm text-[12px] leading-snug text-neutral-600">
        O histórico de uso vive no SQLite local e só aparece com o backend do cockpit rodando em <span className="font-mono">127.0.0.1</span>.
      </p>
    </div>
  );
}

function Trend({ series }: { series: DailyUsage[] }) {
  const dayLabel = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const max = Math.max(1, ...series.map((d) => d.cost));
  const totalCost = series.reduce((a, d) => a + d.cost, 0);
  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-500">
          <Icon name="zap" size={12} /> custo por dia · {series.length}d
        </span>
        <span className="font-mono text-[11px] text-emerald-400/80">{usd(totalCost)}</span>
      </div>
      <div className="flex h-24 items-end gap-1">
        {series.map((d) => {
          const h = Math.max(2, Math.round((d.cost / max) * 100));
          return (
            <div key={d.day} className="group/bar flex flex-1 flex-col items-center justify-end gap-1">
              <div className="relative flex w-full justify-center">
                <div
                  className="w-full max-w-[18px] rounded-sm bg-sky-500/70 transition-colors group-hover/bar:bg-sky-400"
                  style={{ height: `${h}%`, minHeight: '2px' }}
                  title={`${dayLabel(d.day)} · ${usd(d.cost)} · ${fmt(d.output)} out`}
                />
              </div>
              <span className="text-[8.5px] tabular-nums text-neutral-600">{new Date(d.day).getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-16 flex flex-col items-center px-4 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        <Icon name="zap" size={18} />
      </div>
      <p className="text-[12.5px] font-medium text-neutral-400">Sem dados de uso ainda</p>
      <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">Os tokens são registrados conforme você conversa com o agente.</p>
    </div>
  );
}

interface Props {
  connected: boolean;
  usageStats: UsageStats | null;
  onUsageList: () => void;
  sessions: Session[];
  onOpenSession: (id: string) => void;
}

export function Observatorio({ connected, usageStats, onUsageList, sessions, onOpenSession }: Props) {
  useEffect(() => { if (connected) onUsageList(); }, [connected, onUsageList]);

  const known = useMemo(() => new Set(sessions.map((s) => s.id)), [sessions]);
  const titleOf = useMemo(() => {
    const m = new Map(sessions.map((s) => [s.id, s.title || s.snippet]));
    return (id: string) => m.get(id) || id.slice(0, 8);
  }, [sessions]);

  const rows = usageStats?.sessions ?? [];
  const maxOut = Math.max(1, ...rows.map((r) => r.outputTokens));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">uso</span>
          <Badge tone="neutral">{rows.length} sessões</Badge>
        </div>
      </div>

      {!connected ? (
        <Offline />
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="custo estimado" value={usd(usageStats?.totalCost ?? 0)} icon="zap" />
            <Stat label="tokens de saída" value={fmt(usageStats?.totalOutput ?? 0)} icon="arrowUp" />
            <Stat label="amostras" value={fmt(usageStats?.totalSamples ?? 0)} icon="zap" />
            <Stat label="sessões ativas" value={String(rows.length)} icon="message" />
          </div>

          {(usageStats?.series?.length ?? 0) > 0 && <Trend series={usageStats!.series} />}

          {rows.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-800">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/40 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2 font-medium">sessão</th>
                    <th className="px-3 py-2 font-medium">contexto</th>
                    <th className="px-3 py-2 font-medium">saída</th>
                    <th className="px-3 py-2 font-medium">custo</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">amostras</th>
                    <th className="px-3 py-2 text-right font-medium">visto</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const fill = Math.min(100, Math.round((r.ctxTokens / CTX_WINDOW) * 100));
                    const openable = known.has(r.sessionId);
                    return (
                      <tr
                        key={r.sessionId}
                        onClick={openable ? () => onOpenSession(r.sessionId) : undefined}
                        title={openable ? 'Abrir sessão no chat' : undefined}
                        className={`border-b border-neutral-800/60 last:border-0 hover:bg-neutral-900/40 ${openable ? 'cursor-pointer' : ''}`}
                      >
                        <td className="max-w-0 px-3 py-2">
                          <div className="truncate text-neutral-300">{titleOf(r.sessionId)}</div>
                          {r.model && <div className="truncate font-mono text-[10px] text-neutral-600">{r.model}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
                              <div className={`h-full rounded-full ${fill > 75 ? 'bg-red-500' : fill > 50 ? 'bg-amber-500' : 'bg-orange-500'}`} style={{ width: `${fill}%` }} />
                            </div>
                            <span className="font-mono text-[11px] text-neutral-500">{fmt(r.ctxTokens)}</span>
                            {fill >= 75 && (
                              <span title="Contexto quase cheio — considere uma nova sessão" className="flex items-center gap-0.5 rounded bg-red-500/10 px-1 text-[9.5px] font-medium text-red-400">
                                <Icon name="zap" size={9} /> {fill}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
                              <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((r.outputTokens / maxOut) * 100)}%` }} />
                            </div>
                            <span className="font-mono text-[11px] text-neutral-400">{fmt(r.outputTokens)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-emerald-400/80">{usd(r.costUsd)}</td>
                        <td className="hidden px-3 py-2 font-mono text-neutral-500 sm:table-cell">{r.samples}</td>
                        <td className="px-3 py-2 text-right text-neutral-500">{rel(r.lastTs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
