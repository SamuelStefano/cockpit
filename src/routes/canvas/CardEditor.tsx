import { useState } from 'react';
import { CARD_STATUSES, CONTENT_FORMATS, type CanvasCard, type CanvasEdge, type CanvasNode, type TermStats } from '../../../shared/canvas';
import { FORMAT_LABEL } from '../../../shared/canvas-prompt';
import type { DflPointsSnapshot } from '../../../shared/protocol';
import type { DflWriteResult } from '../../cockpit/usePoints';
import { Button, Input, Modal, ToggleChip } from '../../components/primitives';
import { STATUS_LABEL } from './canvas-labels';
import { CardReusePicker } from './CardReusePicker';
import { DflLinkSection } from './DflLinkSection';
import { useCardReuse } from './useCardReuse';

interface Props {
  card: CanvasCard;
  isNew: boolean;
  node: (id: string) => CanvasNode | undefined;
  // Reuse picker (session-reuse.ts via useCardReuse): sessions/edges/running
  // feed the ranking; termStats seeds it and onCtxStats ('canvas-ctx-stats',
  // NOT the window poller's 'canvas-term-stats' — see its own comment,
  // shared/protocol.ts) fetches the REAL numbers for the ranked pool (most
  // candidates never had an open terminal).
  sessions: CanvasNode[];
  edges: CanvasEdge[];
  running: Set<string>;
  termStats: Record<string, TermStats>;
  onCtxStats: (sessions: string[]) => void;
  onSave: (card: CanvasCard) => void;
  onRun: (card: CanvasCard) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  // Kanban<->DFL link (opt-in, DFL-area cards only — see DflLinkSection).
  dflSnapshot: DflPointsSnapshot | null;
  onDflTaskLink: (cardId: string, taskId: string) => Promise<DflWriteResult>;
  onDflTaskCreateLink: (cardId: string, taskName: string, epicId: string, deliveryId: string, why: string, what: string) => Promise<DflWriteResult>;
  onDflTaskUnlink: (cardId: string) => boolean;
  onDflTaskConfirmSync: (cardId: string) => Promise<DflWriteResult>;
}

function Chips({ ids, prefix, node, onRemove }: { ids: string[]; prefix: 'c' | 's'; node: Props['node']; onRemove: (id: string) => void }) {
  return (
    <>
      {ids.map((id) => (
        <ToggleChip key={id} on icon="x" title="remover" className="max-w-[14rem]" onClick={() => onRemove(id)}>
          <span className="truncate">{node(`${prefix}:${id}`)?.title ?? id}</span>
        </ToggleChip>
      ))}
    </>
  );
}

export function CardEditor({
  card: initial, isNew, node, sessions, edges, running, termStats, onCtxStats, onSave, onRun, onDelete, onClose,
  dflSnapshot, onDflTaskLink, onDflTaskCreateLink, onDflTaskUnlink, onDflTaskConfirmSync,
}: Props) {
  const [card, setCard] = useState(initial);
  const patch = (p: Partial<CanvasCard>) => setCard((c) => ({ ...c, ...p }));
  const ok = card.title.trim().length > 0;
  const content = card.kind === 'content';
  const { candidates, pickReuse } = useCardReuse({ isNew, card, patch, sessions, edges, running, termStats, onCtxStats });
  // Server-derived (server/canvas/areas.ts), never client-guessed — a brand
  // new (unsaved) card has no node yet, so it can't offer the link until
  // saved once (same reason its context/session chips only work post-save).
  const isDflArea = !isNew && node(`k:${card.id}`)?.area === 'dfl';

  return (
    <Modal
      open onClose={onClose} icon={content ? 'sparkles' : 'zap'} maxWidth="max-w-xl"
      title={isNew ? (content ? 'Novo conteúdo' : 'Novo card') : 'Editar card'}
      footer={(
        <div className="flex w-full items-center gap-2">
          {!isNew && <Button variant="danger" size="sm" icon="trash" onClick={() => onDelete(card.id)}>excluir</Button>}
          <span className="flex-1" />
          <Button variant="secondary" size="sm" disabled={!ok} onClick={() => onSave(card)}>{isNew ? 'salvar no ToDo' : 'salvar'}</Button>
          <Button size="sm" icon="play" disabled={!ok || card.status !== 'todo'} onClick={() => onRun(card)}>salvar e rodar</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <ToggleChip on={!content} icon="zap" onClick={() => patch({ kind: 'task', format: undefined })}>tarefa</ToggleChip>
          <ToggleChip on={content} icon="sparkles" onClick={() => patch({ kind: 'content', format: card.format ?? 'post' })}>conteúdo</ToggleChip>
        </div>
        <Input autoFocus placeholder="título" value={card.title} onChange={(e) => patch({ title: e.target.value })} />
        {!isNew && (
          // O kanban só move card por HTML5 drag-and-drop, que não é confiável em
          // toque — este é o único jeito de mudar status num celular.
          <div className="flex flex-wrap gap-1.5">
            {CARD_STATUSES.map((s) => (
              <ToggleChip key={s} on={card.status === s} icon="check" onClick={() => patch({ status: s })}>{STATUS_LABEL[s]}</ToggleChip>
            ))}
          </div>
        )}
        {content && (
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_FORMATS.map((f) => <ToggleChip key={f} on={card.format === f} icon="file" onClick={() => patch({ format: f })}>{FORMAT_LABEL[f]}</ToggleChip>)}
          </div>
        )}
        <textarea
          value={card.prompt} onChange={(e) => patch({ prompt: e.target.value })} rows={6}
          placeholder={content ? 'briefing: público, ângulo, o que destacar' : 'o que o agente deve fazer'}
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[12.5px] text-neutral-100 placeholder:text-neutral-600 focus:border-orange-500/50 focus:outline-hidden"
        />
        <div>
          <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Contextos e sessões que o agente recebe</div>
          <div className="flex flex-wrap gap-1">
            <Chips ids={card.contextIds} prefix="c" node={node} onRemove={(id) => patch({ contextIds: card.contextIds.filter((x) => x !== id) })} />
            <Chips ids={card.sessionIds} prefix="s" node={node} onRemove={(id) => patch({ sessionIds: card.sessionIds.filter((x) => x !== id) })} />
            {!card.contextIds.length && !card.sessionIds.length && <span className="text-[11px] text-neutral-600">nenhum — selecione nós no canvas antes de criar o card</span>}
          </div>
        </div>
        <CardReusePicker reuse={card.reuse} candidates={candidates} onClear={() => patch({ reuse: undefined })} onPick={pickReuse} />
        {(isDflArea || card.dfl) && (
          <DflLinkSection
            card={card} isDflArea={isDflArea} snapshot={dflSnapshot}
            // Optimistic local patch on top of the server round-trip: without
            // it the modal's own `card` state (a snapshot taken at open time)
            // would keep showing the old link/unlink state until the editor
            // is closed and reopened.
            onLink={async (id, taskId) => { const r = await onDflTaskLink(id, taskId); if (r.ok) patch({ dfl: { taskId, lastSyncedAt: Date.now() } }); return r; }}
            onCreateLink={onDflTaskCreateLink}
            onUnlink={(id) => { const ok = onDflTaskUnlink(id); patch({ dfl: undefined }); return ok; }}
            onConfirmSync={onDflTaskConfirmSync}
          />
        )}
      </div>
    </Modal>
  );
}
