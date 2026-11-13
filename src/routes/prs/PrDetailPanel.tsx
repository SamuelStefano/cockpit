import { useState } from 'react';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { Segmented } from '../../components/primitives/Segmented';
import { Skeleton } from '../../components/primitives/Skeleton';
import type { DetailEntry } from './prs-bus';
import { PrActions } from './PrActions';
import { PrBadges } from './PrBadges';
import { PrChecksTab } from './PrChecksTab';
import { PrConversationTab } from './PrConversationTab';
import { PrDiffTab } from './PrDiffTab';
import { PrSummaryTab } from './PrSummaryTab';
import { detailTabs, type DetailTab } from './prs-view';
import type { PrActionDeps } from './usePrActions';
import type { PrSummary } from '../../../shared/prs';

interface PrDetailPanelProps extends PrActionDeps {
  pr: PrSummary;
  entry?: DetailEntry;
  canMerge: boolean;
  onRetry: () => void;
  // The chat panel already is that conversation: no button back to itself.
  hideSessionLink?: boolean;
}

export function PrDetailPanel({ pr, entry, canMerge, onRetry, hideSessionLink = false, ...deps }: PrDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('code');
  const detail = entry?.detail ?? null;
  const loading = !detail && !entry?.error;
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <header className="space-y-2">
        <h2 className="text-[18px] font-semibold leading-snug text-neutral-100">{pr.title}</h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-neutral-500">
          <Badge href={pr.url} tone="orange">{pr.repo}#{pr.number}</Badge>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate rounded-md bg-neutral-900 px-1.5 py-0.5 text-neutral-300">{pr.headRef}</span>
            <Icon name="chevronRight" size={12} className="shrink-0" />
            <span className="truncate rounded-md bg-neutral-900 px-1.5 py-0.5">{pr.baseRef}</span>
          </span>
          <span>{pr.author}</span>
        </p>
        <div className="flex flex-wrap gap-1"><PrBadges pr={pr} /></div>
      </header>
      <PrActions pr={hideSessionLink ? { ...pr, sessionId: undefined } : pr} sendTo={pr.sessionId} detail={detail} canMerge={canMerge} {...deps} />
      <Segmented items={detailTabs(pr, detail)} value={tab} onChange={setTab} label="Seções da PR" />
      {entry?.error && !detail && tab !== 'code' && (
        <div className="flex items-center gap-2 text-[13px] text-red-400">
          <span>{entry.error}</span>
          <Button variant="ghost" size="xs" onClick={onRetry}>Tentar de novo</Button>
        </div>
      )}
      {tab === 'code' && <PrDiffTab pr={pr} detail={detail} />}
      {tab === 'summary' && <PrSummaryTab pr={pr} body={detail?.body} />}
      {(tab === 'checks' || tab === 'conversation') && loading && <Skeleton className="h-24 w-full" />}
      {tab === 'checks' && detail && <PrChecksTab detail={detail} />}
      {tab === 'conversation' && detail && <PrConversationTab detail={detail} />}
    </div>
  );
}
