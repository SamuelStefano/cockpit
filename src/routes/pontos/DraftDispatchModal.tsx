import type { DflDraft } from '../../../shared/dfl-drafts';
import { serializeDraftsNote } from '../../../shared/dfl-drafts-note';
import { Button, Modal } from '../../components/primitives';
import { pendingTotals } from './draft-cap';
import { brl, fmtPts } from './money';

interface Props {
  drafts: DflDraft[];
  pointValue: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Last look before an agent writes to DFL prod: what will be created, and the
// exact note the agent receives.
export function DraftDispatchModal({ drafts, pointValue, busy, onConfirm, onClose }: Props) {
  const t = pendingTotals(drafts, pointValue);
  const tasks = drafts.reduce((s, d) => s + d.tasks.length, 0);
  return (
    <Modal
      open onClose={onClose} title={drafts.length === 1 ? 'Criar épico no DFL' : `Criar ${drafts.length} épicos no DFL`}
      icon="zap" maxWidth="max-w-xl"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button onClick={onConfirm} loading={busy}>Disparar agente</Button>
      </>}
    >
      <div className="flex flex-col gap-3 text-[12.5px] text-neutral-400">
        <p>
          Um agente vai criar <span className="text-neutral-200">{drafts.length} {drafts.length === 1 ? 'épico' : 'épicos'}</span>,
          uma delivery por épico e <span className="text-neutral-200">{tasks} tasks</span> (done, owner Samuel):
          <span className="tabular-nums text-neutral-200"> {fmtPts(t.points)} pt · {brl(t.valueCents)}</span>.
          Nada é faturado — a fatura continua sendo clique seu.
        </p>
        {t.overCount > 0 && (
          <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/6 px-3 py-2 text-yellow-300">
            {t.overCount} {t.overCount === 1 ? 'épico passa' : 'épicos passam'} do teto de R$ 5.000 por épico. Quebre antes de criar.
          </p>
        )}
        <details className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
          <summary className="cursor-pointer text-[12px] text-neutral-300">Ver a nota exata que o agente recebe</summary>
          <pre className="scroll-thin mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-400">
            {serializeDraftsNote(drafts, pointValue)}
          </pre>
        </details>
      </div>
    </Modal>
  );
}
