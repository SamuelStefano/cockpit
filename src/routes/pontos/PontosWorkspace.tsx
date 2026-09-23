import type { ComponentProps } from 'react';
import type { DflPointsSnapshot, PointsEntry } from '../../../shared/protocol';
import type { DflDraft, DraftOp } from '../../../shared/dfl-drafts';
import { usePontosPage } from './usePontosPage';
import { PontosTopBar } from './PontosTopBar';
import { KpiStrip } from './KpiStrip';
import { EpicNavigator } from './EpicNavigator';
import { MobileNavBar } from './MobileNavBar';
import { DetailPane } from './DetailPane';
import { DraftDispatchModal } from './DraftDispatchModal';
import { NewEpicAgentModal } from './NewEpicAgentModal';
import { TaskEditModal } from './TaskEditModal';
import type { LedgerTab } from './LedgerTab';

interface Props {
  connected: boolean;
  now: number;
  snapshot: DflPointsSnapshot | null;
  waiting: boolean;
  syncing: boolean;
  onSync: () => void;
  drafts: DflDraft[];
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
  points: PointsEntry[];
  ledger: ComponentProps<typeof LedgerTab>;
}

// Two-pane workspace: a slim month strip on top, the epic navigator on the left
// (a drawer on phones) and the selected epic, invoices or ledger on the right.
export function PontosWorkspace(props: Props) {
  const { snapshot, syncing, onSync } = props;
  const pg = usePontosPage(props);
  const { ws, d } = pg;
  const navigator = (
    <EpicNavigator nav={ws.nav} activeKey={ws.selection.key} onSelect={ws.select} filter={ws.filter} onFilter={ws.setFilter}
      query={ws.query} onQuery={ws.setQuery} marks={pg.marks} invoices={snapshot?.invoices.length ?? 0} ledger={props.points.length}
      onNewEpic={() => pg.newEpic.set(true)} />
  );
  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:min-h-0 lg:flex-1 2xl:border-x 2xl:border-neutral-800/60">
        <PontosTopBar month={pg.month} state={pg.monthState} syncLabel={pg.m.syncLabel} stale={pg.m.stale} syncing={syncing} onSync={onSync}
          onNewEpic={() => pg.newEpic.set(true)} />
        <KpiStrip m={pg.m} totals={pg.totals} offPoints={pg.offPoints} offAmountCents={pg.offAmountCents} drafts={pg.draftTotals} />
        <MobileNavBar selection={ws.selection} open={ws.drawer} onOpen={ws.setDrawer}>{navigator}</MobileNavBar>
        <div className="flex lg:min-h-0 lg:flex-1">
          <aside className="hidden w-[360px] shrink-0 flex-col border-r border-neutral-800/80 lg:flex xl:w-[400px]">{navigator}</aside>
          <main className="scroll-thin min-w-0 flex-1 px-3 py-3 sm:px-5 sm:py-4 lg:overflow-y-auto">
            <DetailPane selection={ws.selection} waiting={props.waiting} projects={pg.projects} invoices={snapshot?.invoices ?? []}
              op={d.op} ask={d.ask} ledger={props.ledger} />
          </main>
        </div>
      </div>
      {d.confirming && <DraftDispatchModal request={d.confirming} pointValue={d.pointValue} busy={d.busy} onConfirm={d.dispatch} onClose={d.closeConfirm} />}
      {pg.newEpic.on && <NewEpicAgentModal onClose={() => pg.newEpic.set(false)} />}
      <TaskEditModal />
    </div>
  );
}
