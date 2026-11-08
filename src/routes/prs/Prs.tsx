import { Button } from '../../components/primitives/Button';
import { Drawer } from '../../components/primitives/Drawer';
import { EmptyState } from '../../components/primitives/EmptyState';
import { RouteHeader } from '../../components/primitives/RouteHeader';
import { Segmented } from '../../components/primitives/Segmented';
import { SkeletonCards } from '../../components/primitives/SkeletonCards';
import { useIsMobile } from '../../app/useIsMobile';
import { PrDetailPanel } from './PrDetailPanel';
import { PrList } from './PrList';
import { PrsSidebar } from './PrsSidebar';
import { mergedCountLabel, relativeTime } from './prs-view';
import type { PrActionDeps } from './usePrActions';
import { usePrs, type PrTab } from './usePrs';

const TABS = [
  { id: 'mine' as const, label: 'Minhas abertas' },
  { id: 'review' as const, label: 'Pra revisar' },
  { id: 'merged' as const, label: 'Mergeadas' },
];

type PrsProps = PrActionDeps & { connected: boolean };

export function Prs({ connected, ...deps }: PrsProps) {
  const s = usePrs(connected);
  const mobile = useIsMobile();
  const snap = s.snapshot;
  const detailPanel = s.selected && (
    <PrDetailPanel key={s.selected.url} pr={s.selected} entry={s.detail} canMerge={s.tab === 'mine'} onRetry={s.retryDetail} {...deps} />
  );

  let body;
  if (!snap) body = s.loading || !connected ? <SkeletonCards count={4} /> : <EmptyState icon="gitPullRequest" size="sm" title="Sem dados ainda" description="Aguardando o servidor." />;
  else if (snap.error && !snap.mine.length && !snap.merged.length && !snap.review.length) body = <EmptyState icon="alertTriangle" size="sm" title="Não deu pra carregar as PRs" description={snap.error} />;
  else if (!s.visible.length) body = <EmptyState icon="gitPullRequest" size="sm" title="Nenhuma PR aqui" />;
  else body = <PrList tab={s.tab} prs={s.visible} days={s.days} selectedUrl={s.selectedUrl} onSelect={s.select} />;

  const list = (
    <div className="scroll-thin min-w-0 flex-1 overflow-y-auto p-3">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented items={TABS} value={s.tab} onChange={(t: PrTab) => s.changeTab(t)} label="Lista de PRs" />
        {s.tab === 'merged' && snap && (
          <span className="text-[12px] text-neutral-500">{mergedCountLabel(s.visible.length, snap.mergedSinceDays, snap.mergedTruncated && !s.filter.org && !s.filter.repo)}</span>
        )}
        {snap?.error && (snap.mine.length > 0 || snap.merged.length > 0) && (
          <span className="text-[12px] text-red-400">Última atualização falhou: {snap.error}</span>
        )}
      </div>
      {body}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RouteHeader
        title="Pull requests" icon="gitPullRequest"
        subtitle={snap ? `atualizado ${relativeTime(snap.fetchedAt)}` : undefined}
        actions={<Button variant="secondary" size="sm" icon="rotate" loading={s.loading} onClick={s.refresh} disabled={!connected}>Atualizar</Button>}
      />
      {mobile && <PrsSidebar horizontal orgs={s.orgs} total={s.total} filter={s.filter} onChange={s.setFilter} />}
      <div className="flex min-h-0 flex-1">
        {!mobile && <PrsSidebar horizontal={false} orgs={s.orgs} total={s.total} filter={s.filter} onChange={s.setFilter} />}
        {list}
        {!mobile && (
          <aside className="scroll-thin w-[28rem] shrink-0 overflow-y-auto border-l border-neutral-800/80">
            {detailPanel || <EmptyState icon="gitPullRequest" size="sm" title="Selecione uma PR" />}
          </aside>
        )}
      </div>
      {mobile && (
        <Drawer open={!!s.selected} onClose={() => s.select(null)} title={s.selected ? `#${s.selected.number}` : 'PR'} side="right" width="w-full">
          {detailPanel}
        </Drawer>
      )}
    </div>
  );
}
