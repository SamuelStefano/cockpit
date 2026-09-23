import { useState } from 'react';
import type { DflDraft, DraftOp } from '../../../shared/dfl-drafts';
import { Button, EmptyState, SectionHeader, Skeleton } from '../../components/primitives';
import { useDrafts } from './useDrafts';
import { DraftEpicCard } from './DraftEpicCard';
import { DraftDispatchModal } from './DraftDispatchModal';
import { AgentTasksModal } from './AgentTasksModal';
import { brl, fmtPts } from './money';

interface Props {
  connected: boolean;
  loaded: boolean;
  drafts: DflDraft[];
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
}

// Staging area between the orchestrator and DFL: epics → tasks with points and PR
// refs, reviewed here and sent to DFL by an agent with one click.
export function DraftsSection({ connected, loaded, drafts, onDraftsGet, onDraftOp }: Props) {
  const s = useDrafts({ connected, drafts, onDraftsGet, onDraftOp });
  const [freeText, setFreeText] = useState(false);
  const count = s.totals.count
    ? `${s.totals.count} ${s.totals.count === 1 ? 'épico' : 'épicos'} · ${fmtPts(s.totals.points)} pt · ${brl(s.totals.valueCents)}`
    : undefined;

  return (
    <section className="mb-8">
      <SectionHeader
        title="Rascunhos para o DFL" icon="layers" count={count}
        description="O que o agente fez, agrupado em épicos. Revise pontos e títulos; “Criar no DFL” manda um agente criar épico, delivery e tasks."
        actions={<>
          <Button variant="ghost" size="sm" icon="pencil" onClick={() => setFreeText(true)}>Descrever em texto</Button>
          {s.pending.length > 1 && (
            <Button size="sm" icon="zap" onClick={() => s.askDispatch(s.pending)}>Criar todos no DFL</Button>
          )}
        </>}
      />
      {!loaded && connected
        ? <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-[92px] w-full rounded-xl" />)}</div>
        : s.sorted.length === 0
        ? <EmptyState icon="layers" title="Nenhum rascunho" className="rounded-xl border border-dashed border-neutral-800 py-8"
            description="Quando o agente fechar uma leva de trabalho, ele deixa aqui os épicos com tasks, pontos e PRs (deck-drafts import). Ou descreva o trabalho em texto." />
        : <div className="space-y-2">
            {s.sorted.map((d) => (
              <DraftEpicCard key={d.id} draft={d} pointValue={s.pointValue} onOp={s.op} onDispatch={() => s.askDispatch([d])} />
            ))}
          </div>}
      {s.confirming && (
        <DraftDispatchModal drafts={s.confirming} pointValue={s.pointValue} busy={s.busy} onConfirm={s.dispatch} onClose={s.closeConfirm} />
      )}
      {freeText && <AgentTasksModal onClose={() => setFreeText(false)} />}
    </section>
  );
}
