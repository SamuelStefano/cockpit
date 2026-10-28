import { useEffect } from 'react';
import { SectionTitle } from '../../components/primitives';
import { UsagePanel } from '../../components/chrome/UsagePanel';
import { usageRows } from '../../components/chrome/usage-rows';
import { usageChip } from '../../components/chrome/usage-agent';
import type { UsageDockProps } from '../../components/chrome/sidebar/UsageDock';
import { relReset } from '../../lib/time';
import { Observatorio } from '../Observatorio';
import type { Session } from '../../data/types';
import type { UsageStats } from '../../../shared/protocol';

interface UsoProps {
  dock: UsageDockProps;
  connected: boolean;
  usageStats: UsageStats | null;
  onUsageList: () => void;
  sessions: Session[];
  rate: { resetsAt: number; status: string } | null;
  onOpenSession: (id: string) => void;
}

export function Uso({ dock, connected, usageStats, onUsageList, sessions, rate, onOpenSession }: UsoProps) {
  const { onRefreshPlanUsage, onRefreshGrokUsage } = dock;
  const chip = usageChip(dock.usageAgent ?? 'claude', { usage: dock.planUsage, blockedUntil: dock.planBlockedUntil ?? null, readAt: dock.planReadAt ?? null, nextReadAt: dock.planNextReadAt ?? null }, dock.grokUsage);
  const title = chip.agent === 'grok' ? 'Uso do Grok' : 'Uso do plano';
  const warn = chip.gate && !!dock.quotaWarn;
  const paused = chip.gate && !!dock.quotaPaused;
  const resetAt = chip.gate ? dock.quotaResetsAt : null;
  const refresh = chip.agent === 'grok' ? onRefreshGrokUsage : onRefreshPlanUsage;
  useEffect(() => { refresh?.(); }, [refresh]);

  return (
    <>
      <SectionTitle>Uso</SectionTitle>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 hairline [&>div]:w-full">
        <UsagePanel inline rows={usageRows(chip.usage)} reset={resetAt ? relReset(resetAt) : ''} warn={warn || paused} blockedUntil={chip.blockedUntil} readAt={chip.readAt} nextReadAt={chip.nextReadAt} title={title} secondary={chip.secondary} />
      </div>
      <SectionTitle>Por conversa e por modelo</SectionTitle>
      <div className="flex h-[640px] flex-col overflow-hidden rounded-xl border border-neutral-800">
        <Observatorio connected={connected} usageStats={usageStats} onUsageList={onUsageList} sessions={sessions} rate={rate} onOpenSession={onOpenSession} />
      </div>
    </>
  );
}
