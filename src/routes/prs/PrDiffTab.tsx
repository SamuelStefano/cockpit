import type { PrDetail, PrReviewThread, PrSummary } from '../../../shared/prs';
import { Button } from '../../components/primitives/Button';
import { EmptyState } from '../../components/primitives/EmptyState';
import { IconButton } from '../../components/primitives/IconButton';
import { Input } from '../../components/primitives/Input';
import { Skeleton } from '../../components/primitives/Skeleton';
import { PrDiffFileCard } from './PrDiffFileCard';
import { PrDiffFileNav } from './PrDiffFileNav';
import { usePrDiff } from './usePrDiff';

const NO_THREADS: PrReviewThread[] = [];

export function PrDiffTab({ pr, detail }: { pr: PrSummary; detail: PrDetail | null }) {
  const d = usePrDiff(pr.url);
  const threads = detail?.threads ?? NO_THREADS;

  if (d.loading) return <div className="space-y-3"><Skeleton className="h-9 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-24 w-full" /></div>;
  if (!d.diff) {
    return (
      <EmptyState icon="alertTriangle" size="sm" title="Não deu pra carregar o código" description={d.error}>
        <Button variant="secondary" size="sm" icon="rotate" onClick={d.retry}>Tentar de novo</Button>
      </EmptyState>
    );
  }
  if (!d.total) return <EmptyState icon="file" size="sm" title="Esta PR não mudou nenhum arquivo" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input size="sm" icon="search" value={d.query} onChange={(e) => d.setQuery(e.target.value)} placeholder="Filtrar arquivos" aria-label="Filtrar arquivos" className="min-w-40 flex-1 sm:max-w-64" />
        <span className="font-mono text-[12px] tabular-nums text-neutral-500">
          {d.total} {d.total === 1 ? 'arquivo' : 'arquivos'} · <span className="text-emerald-400">+{pr.additions}</span> <span className="text-red-400">−{pr.deletions}</span>
          {d.viewedCount > 0 && <> · {d.viewedCount}/{d.total} vistos</>}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <IconButton icon="wrapText" size="xs" label={d.wrap ? 'Não quebrar linhas' : 'Quebrar linhas longas'} aria-pressed={d.wrap} onClick={() => d.setWrap(!d.wrap)} className={d.wrap ? 'bg-neutral-800 text-neutral-100' : ''} />
          <Button variant="ghost" size="xs" onClick={() => d.setAll(!d.anyOpen)}>{d.anyOpen ? 'Recolher tudo' : 'Expandir tudo'}</Button>
        </span>
      </div>
      {d.diff.truncated && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/8 px-3 py-2 text-[12px] text-yellow-300">
          PR grande: parte do código ficou de fora daqui. <a href={`${pr.url}/files`} target="_blank" rel="noreferrer" className="underline">Ver tudo no GitHub</a>.
        </p>
      )}
      <div className="flex items-start gap-4">
        <PrDiffFileNav files={d.files} onJump={(path) => d.toggleOpen(path, true)} />
        <div className="min-w-0 flex-1 space-y-3">
          {d.files.length
            ? d.files.map((v) => <PrDiffFileCard key={v.file.path} file={v.file} rows={v.rows} open={v.open} viewed={v.viewed} prUrl={pr.url} threads={threads} wrap={d.wrap} onToggle={d.toggleOpen} onViewed={d.toggleViewed} />)
            : <EmptyState size="xs" title="Nenhum arquivo com esse nome" />}
        </div>
      </div>
    </div>
  );
}
