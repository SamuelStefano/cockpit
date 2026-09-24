import type { ComponentProps } from 'react';
import type { DflInvoice, DflProjectNode } from '../../../shared/protocol';
import type { DraftOp } from '../../../shared/dfl-drafts';
import { Skeleton } from '../../components/primitives';
import type { Selection } from './useWorkspace';
import type { AskDispatch } from './useDraftEpic';
import { usePontosControls } from './pontosControls';
import { DraftEpicDetail } from './DraftEpicDetail';
import { DflEpicDetail } from './DflEpicDetail';
import { DflInvoices } from './DflInvoices';
import { LedgerTab } from './LedgerTab';
import { SelectionBar } from './SelectionBar';

interface Props {
  selection: Selection;
  waiting: boolean;
  projects: DflProjectNode[];
  invoices: DflInvoice[];
  op: (o: DraftOp) => void;
  ask: AskDispatch;
  ledger: ComponentProps<typeof LedgerTab>;
  stale?: boolean;
}

// Right pane: whatever the navigator points at — a draft, a DFL epic, the
// invoices or the ledger. The invoice selection bar follows across DFL epics.
export function DetailPane({ selection, waiting, projects, invoices, op, ask, ledger, stale = false }: Props) {
  const { pointValue, selecting } = usePontosControls();
  const { draft, dfl, view } = selection;
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      {draft && <DraftEpicDetail key={draft.id} draft={draft} pointValue={pointValue} op={op} ask={ask} />}
      {dfl && <DflEpicDetail epic={dfl.epic} project={dfl.project} />}
      {view === 'faturas' && (waiting
        ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
        : <DflInvoices invoices={invoices} />)}
      {view === 'ledger' && <LedgerTab {...ledger} />}
      {selecting && <SelectionBar projects={projects} stale={stale} />}
    </div>
  );
}

