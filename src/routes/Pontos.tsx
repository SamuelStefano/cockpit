import type { PointsEntry, DflPointsSnapshot } from '../../shared/protocol';
import type { DflDraft, DraftOp } from '../../shared/dfl-drafts';
import { RouteHeader, Skeleton, Tabs } from '../components/primitives';
import { usePontos } from './pontos/usePontos';
import { useDflPontos } from './pontos/useDflPontos';
import { usePontosControlsState, PontosControlsProvider, type DflWriteApi } from './pontos/pontosControls';
import { TaskEditModal } from './pontos/TaskEditModal';
import { recomputeTotals } from './pontos/pontosPrefs';
import { MonthSummary } from './pontos/MonthSummary';
import { DraftsSection } from './pontos/DraftsSection';
import { DflTree } from './pontos/DflTree';
import { DflInvoices } from './pontos/DflInvoices';
import { LedgerTab } from './pontos/LedgerTab';

interface Props {
  connected: boolean;
  points: PointsEntry[];
  total: number;
  loaded: boolean;
  onPointsGet: () => void;
  onPointsAdd: (title: string, points: number, description?: string) => boolean;
  onPointsCorrect: (entryId: string, points: number) => boolean;
  onPointsNote: (entryId: string, description: string) => boolean;
  onPointsDelete: (entryId: string) => boolean;
  dflSnapshot: DflPointsSnapshot | null;
  dflLoaded: boolean;
  dflSyncing: boolean;
  onDflGet: () => void;
  onDflSync: () => void;
  onDflChange: DflWriteApi['onDflChange'];
  onDflInvoice: DflWriteApi['onDflInvoice'];
  onPontosAgent: DflWriteApi['onPontosAgent'];
  drafts: DflDraft[];
  draftsLoaded: boolean;
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
}

// Reading order = the life of a point: month summary (what can be invoiced) →
// drafts waiting to go to DFL → what already is in DFL → the agent's raw ledger.
export function Pontos(props: Props) {
  const { connected, points, total, loaded, dflSnapshot, dflLoaded, dflSyncing, onDflGet, onDflSync, onDflChange, onDflInvoice, onPontosAgent } = props;
  const p = usePontos(props);
  const { tab, setTab } = useDflPontos({ connected, snapshot: dflSnapshot, onDflGet });
  const controls = usePontosControlsState({ onDflChange, onDflInvoice, onPontosAgent });
  const projects = dflSnapshot?.projects ?? [];
  const recomputed = dflSnapshot ? recomputeTotals(projects, controls.excluded, controls.pointValue) : null;
  const totals = recomputed?.totals ?? dflSnapshot?.totals;
  const waiting = !dflLoaded && connected;

  return (
    <PontosControlsProvider value={controls}>
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <RouteHeader variant="page" title="Pontos" icon="star"
          subtitle="Do trabalho feito à fatura: rascunho no Deck → épico no DFL → fatura dentro do teto do mês." />

        <MonthSummary snapshot={dflSnapshot} totals={totals} offPoints={recomputed?.offPoints ?? 0} offAmountCents={recomputed?.offAmountCents ?? 0}
          now={p.now} syncing={dflSyncing} onSync={onDflSync} />

        <DraftsSection connected={connected} loaded={props.draftsLoaded} drafts={props.drafts}
          onDraftsGet={props.onDraftsGet} onDraftOp={props.onDraftOp} />

        <Tabs className="mb-4" active={tab} onChange={setTab} items={[
          { id: 'arvore', label: 'DFL', icon: 'grip', count: projects.length || undefined },
          { id: 'faturas', label: 'Faturas', icon: 'file', count: dflSnapshot?.invoices.length || undefined },
          { id: 'ledger', label: 'Ledger', icon: 'sparkles', count: points.length || undefined },
        ]} />

        {tab === 'arvore' && (waiting ? <TreeSkeleton /> : <DflTree projects={projects} />)}
        {tab === 'faturas' && (waiting ? <TreeSkeleton /> : <DflInvoices invoices={dflSnapshot?.invoices ?? []} />)}
        {tab === 'ledger' && (
          <LedgerTab connected={connected} loaded={loaded} points={points} total={total} now={p.now} glowing={p.glowing}
            add={p.add} correct={p.correct} note={p.note} remove={p.remove} />
        )}
      </div>
    </div>
    <TaskEditModal />
    </PontosControlsProvider>
  );
}

function TreeSkeleton() {
  return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[52px] w-full rounded-xl" />)}</div>;
}
