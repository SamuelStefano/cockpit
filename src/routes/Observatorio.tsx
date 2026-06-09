import { useEffect, useMemo } from 'react';
import { Badge } from '../components/primitives';
import type { UsageStats } from '../../shared/protocol';
import type { Session } from '../data/mock';
import { fmtNum as fmt, usd, costToday as computeCostToday } from './observatorio.format';
import { Stat } from './observatorio/Stat';
import { Offline } from './observatorio/Offline';
import { Empty } from './observatorio/Empty';
import { Trend } from './observatorio/Trend';
import { RateWindow } from './observatorio/RateWindow';
import { UsageTable } from './observatorio/UsageTable';

interface Props {
  connected: boolean;
  usageStats: UsageStats | null;
  onUsageList: () => void;
  sessions: Session[];
  rate: { resetsAt: number; status: string } | null;
  onOpenSession: (id: string) => void;
}

export function Observatorio({ connected, usageStats, onUsageList, sessions, rate, onOpenSession }: Props) {
  useEffect(() => { if (connected) onUsageList(); }, [connected, onUsageList]);

  const known = useMemo(() => new Set(sessions.map((s) => s.id)), [sessions]);
  const titleOf = useMemo(() => {
    const m = new Map(sessions.map((s) => [s.id, s.title || s.snippet]));
    return (id: string) => m.get(id) || id.slice(0, 8);
  }, [sessions]);

  const rows = usageStats?.sessions ?? [];
  const costToday = useMemo(() => computeCostToday(usageStats?.series ?? []), [usageStats]);
  const avgPerSession = rows.length ? (usageStats?.totalCost ?? 0) / rows.length : 0;

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
          {rate && <RateWindow rate={rate} />}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="custo estimado" value={usd(usageStats?.totalCost ?? 0)} icon="zap" />
            <Stat label="custo hoje" value={usd(costToday)} icon="clock" />
            <Stat label="média/sessão" value={usd(avgPerSession)} icon="message" />
            <Stat label="tokens de saída" value={fmt(usageStats?.totalOutput ?? 0)} icon="arrowUp" />
            <Stat label="amostras" value={fmt(usageStats?.totalSamples ?? 0)} icon="zap" />
            <Stat label="sessões ativas" value={String(rows.length)} icon="message" />
          </div>

          {(usageStats?.series?.length ?? 0) > 0 && <Trend series={usageStats!.series} />}

          {rows.length === 0 ? (
            <Empty />
          ) : (
            <UsageTable rows={rows} known={known} titleOf={titleOf} onOpenSession={onOpenSession} />
          )}
        </div>
      )}
    </div>
  );
}
