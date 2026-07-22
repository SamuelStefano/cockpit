import { useState } from 'react';
import type { PointsEntry, DflPointsSnapshot } from '../../shared/protocol';
import { Button, Icon, EmptyState, Skeleton, Tabs } from '../components/primitives';
import { usePontos } from './pontos/usePontos';
import { useDflPontos } from './pontos/useDflPontos';
import { usePontosControlsState, PontosControlsProvider } from './pontos/pontosControls';
import { recomputeTotals } from './pontos/pontosPrefs';
import { PointsForm } from './pontos/PointsForm';
import { PointsCard } from './pontos/PointsCard';
import { FinanceSummaryBar } from './pontos/FinanceSummaryBar';
import { SyncBar } from './pontos/SyncBar';
import { DflTree } from './pontos/DflTree';
import { DflInvoices } from './pontos/DflInvoices';
import { fmtPts } from './pontos/money';

interface Props {
  connected: boolean;
  points: PointsEntry[];
  total: number;
  loaded: boolean;
  onPointsGet: () => void;
  onPointsAdd: (title: string, points: number, description?: string) => void;
  onPointsCorrect: (entryId: string, points: number) => void;
  onPointsNote: (entryId: string, description: string) => void;
  onPointsDelete: (entryId: string) => void;
  dflSnapshot: DflPointsSnapshot | null;
  dflLoaded: boolean;
  dflSyncing: boolean;
  onDflGet: () => void;
  onDflSync: () => void;
}

// Centro de pontos + financeiro. Árvore/Faturas vêm do snapshot DFL (só-leitura,
// owner-only); Ledger é o registro local que a IA alimenta e você corrige.
export function Pontos(props: Props) {
  const { connected, points, total, loaded, dflSnapshot, dflLoaded, dflSyncing, onDflGet, onDflSync } = props;
  const { now, glowing, add, correct, note, remove } = usePontos(props);
  const { tab, setTab, hasDfl } = useDflPontos({ connected, snapshot: dflSnapshot, onDflGet });
  const controls = usePontosControlsState();
  const [adding, setAdding] = useState(false);
  const projects = dflSnapshot?.projects ?? [];
  const recomputed = dflSnapshot ? recomputeTotals(projects, controls.excluded) : null;
  const totals = recomputed?.totals ?? dflSnapshot?.totals;

  return (
    <PontosControlsProvider value={controls}>
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-4">
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute -left-4 -top-2 h-24 w-40 rounded-full bg-orange-500/[0.08] blur-2xl" />
            <h1 className="relative text-[13px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Pontos & Financeiro</h1>
            <div className="relative mt-1 flex items-baseline gap-2.5">
              <span className="bg-gradient-to-br from-orange-300 to-orange-500 bg-clip-text text-[44px] font-bold leading-none tabular-nums tracking-tight text-transparent drop-shadow-[0_2px_12px_rgba(249,115,22,0.25)]">
                {totals ? fmtPts(totals.totalPoints) : total}
              </span>
              <span className="pb-1 text-[12.5px] text-neutral-500">
                {totals ? `pts no DFL · ${dflSnapshot!.projects.length} projetos` : `pts em ${points.length} ${points.length === 1 ? 'registro' : 'registros'}`}
              </span>
            </div>
          </div>
        </header>

        {tab !== 'ledger' && <SyncBar snapshot={dflSnapshot} syncing={dflSyncing} now={now} onSync={onDflSync} />}
        {tab !== 'ledger' && totals && <FinanceSummaryBar totals={totals} offPoints={recomputed?.offPoints ?? 0} offAmountCents={recomputed?.offAmountCents ?? 0} />}

        <Tabs className="mb-4" active={tab} onChange={setTab} items={[
          { id: 'arvore', label: 'Árvore', icon: 'grip', count: dflSnapshot?.projects.length },
          { id: 'faturas', label: 'Faturas', icon: 'file', count: dflSnapshot?.invoices.length },
          { id: 'ledger', label: 'Ledger', icon: 'star', count: points.length },
        ]} />

        {tab === 'arvore' && (
          !dflLoaded && connected
            ? <TreeSkeleton />
            : <DflTree projects={projects} />
        )}

        {tab === 'faturas' && <DflInvoices invoices={dflSnapshot?.invoices ?? []} />}

        {tab === 'ledger' && (
          <div>
            <div className="mb-3 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setAdding((v) => !v)}>
                <Icon name="plus" size={14} /> adicionar manual
              </Button>
            </div>
            {adding && <PointsForm onAdd={add} onCancel={() => setAdding(false)} />}
            {!loaded && connected
              ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[84px] w-full rounded-xl" />)}</div>
              : points.length === 0
              ? <EmptyState icon="star" title="Nenhum ponto ainda"
                  description="Quando eu terminar uma task com pontuação, ela aparece aqui sozinha. Você também pode adicionar manualmente." />
              : <div className="space-y-2">
                  {points.map((e) => (
                    <PointsCard key={e.entryId} entry={e} now={now} glow={glowing.has(e.entryId)}
                      onCorrect={correct} onNote={note} onDelete={remove} />
                  ))}
                </div>}
          </div>
        )}

        {!hasDfl && dflLoaded && tab === 'arvore' && (
          <p className="mt-3 text-center text-[11.5px] text-neutral-600">Snapshot DFL vazio — clique em sincronizar.</p>
        )}
      </div>
    </div>
    </PontosControlsProvider>
  );
}

function TreeSkeleton() {
  return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[52px] w-full rounded-xl" />)}</div>;
}
