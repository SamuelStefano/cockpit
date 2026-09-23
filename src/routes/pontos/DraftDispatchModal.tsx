import { batchDispatchNotes, serializeDispatchNote, unitDeliveries } from '../../../shared/dfl-drafts-note';
import { draftPoints } from '../../../shared/dfl-drafts';
import { Button, Modal } from '../../components/primitives';
import { draftCap } from './draft-cap';
import type { DispatchRequest } from './useDrafts';
import { brl, centsFromPoints, fmtPts } from './money';

interface Props {
  request: DispatchRequest;
  pointValue: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Last look before an agent writes to DFL prod: what goes (epics, deliveries,
// tasks, value) and the exact note(s) the agent receives.
export function DraftDispatchModal({ request, pointValue, busy, onConfirm, onClose }: Props) {
  const { units } = request;
  const dls = units.flatMap(unitDeliveries);
  const tasks = dls.flatMap((d) => d.tasks);
  const pts = draftPoints({ tasks });
  const over = units.filter((u) => draftCap(u.draft, pointValue).over).length;
  const notes = batchDispatchNotes(units, pointValue).map((b) => serializeDispatchNote(b, pointValue));
  return (
    <Modal
      open onClose={onClose} title={request.title} icon="zap" maxWidth="max-w-2xl"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button onClick={onConfirm} loading={busy}>{notes.length > 1 ? `Disparar ${notes.length} agentes` : 'Disparar agente'}</Button>
      </>}
    >
      <div className="flex flex-col gap-3 text-[12.5px] text-neutral-400">
        <p>
          O agente cria no DFL <span className="text-neutral-200">{units.length} {units.length === 1 ? 'épico' : 'épicos'}</span> (ou reusa, se já existir),{' '}
          <span className="text-neutral-200">{dls.length} {dls.length === 1 ? 'delivery' : 'deliveries'}</span> e{' '}
          <span className="text-neutral-200">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span> (done, owner Samuel):
          <span className="font-mono tabular-nums text-neutral-200"> {fmtPts(pts)} pt · {brl(centsFromPoints(pts, pointValue))}</span>.
          Nada é faturado — a fatura continua sendo clique seu.
        </p>
        {over > 0 && (
          <p className="rounded-md border border-yellow-500/30 bg-yellow-500/6 px-3 py-2 text-yellow-300">
            {over} {over === 1 ? 'épico passa' : 'épicos passam'} do teto de R$ 5.000 por épico. Divida antes de criar.
          </p>
        )}
        {notes.map((note, i) => (
          <details key={i} open={i === 0} className="rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2">
            <summary className="cursor-pointer text-[12px] text-neutral-300">
              {notes.length > 1 ? `Nota ${i + 1} de ${notes.length}` : 'Nota exata que o agente recebe'}
            </summary>
            <pre className="scroll-thin mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-neutral-400">{note}</pre>
          </details>
        ))}
      </div>
    </Modal>
  );
}
