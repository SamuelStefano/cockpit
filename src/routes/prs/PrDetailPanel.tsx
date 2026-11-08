import { useState } from 'react';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { Segmented } from '../../components/primitives/Segmented';
import { Skeleton } from '../../components/primitives/Skeleton';
import type { DetailEntry } from './prs-bus';
import { PrActions } from './PrActions';
import { PrBadges } from './PrBadges';
import { PrChecksTab } from './PrChecksTab';
import { PrConversationTab } from './PrConversationTab';
import { PrFilesTab } from './PrFilesTab';
import { PrSummaryTab } from './PrSummaryTab';
import type { PrActionDeps } from './usePrActions';
import type { PrSummary } from '../../../shared/prs';

type DetailTab = 'summary' | 'files' | 'checks' | 'conversation';
const TABS = [
  { id: 'summary' as const, label: 'Resumo' },
  { id: 'files' as const, label: 'Arquivos' },
  { id: 'checks' as const, label: 'Checks' },
  { id: 'conversation' as const, label: 'Conversa' },
];

interface PrDetailPanelProps extends PrActionDeps {
  pr: PrSummary;
  entry?: DetailEntry;
  canMerge: boolean;
  onRetry: () => void;
}

export function PrDetailPanel({ pr, entry, canMerge, onRetry, ...deps }: PrDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const detail = entry?.detail ?? null;
  const loading = !detail && !entry?.error;
  return (
    <div className="space-y-4 p-4">
      <header className="space-y-2">
        <h2 className="text-[17px] font-semibold leading-snug text-neutral-100">{pr.title}</h2>
        <p className="flex flex-wrap items-center gap-x-2 font-mono text-[12px] text-neutral-500">
          <span>{pr.repo}#{pr.number}</span>
          <span>{pr.headRef} → {pr.baseRef}</span>
          <Badge href={pr.url} tone="orange">GitHub</Badge>
        </p>
        <div className="flex flex-wrap gap-1"><PrBadges pr={pr} /></div>
      </header>
      <PrActions pr={pr} detail={detail} canMerge={canMerge} {...deps} />
      <Segmented items={TABS} value={tab} onChange={setTab} label="Seções da PR" />
      {entry?.error && !detail && (
        <div className="flex items-center gap-2 text-[13px] text-red-400">
          <span>{entry.error}</span>
          <Button variant="ghost" size="xs" onClick={onRetry}>Tentar de novo</Button>
        </div>
      )}
      {tab === 'summary' && <PrSummaryTab pr={pr} body={detail?.body} />}
      {tab !== 'summary' && loading && <Skeleton className="h-24 w-full" />}
      {tab === 'files' && detail && <PrFilesTab detail={detail} />}
      {tab === 'checks' && detail && <PrChecksTab detail={detail} />}
      {tab === 'conversation' && detail && <PrConversationTab detail={detail} />}
    </div>
  );
}
