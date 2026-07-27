import { Icon, tokens } from '../primitives';
import { QueuedItem } from './QueuedItem';
import { useQueuedBanner } from './useQueuedBanner';

// Fila do cliente: mensagens digitadas durante um turno, disparadas em ordem
// quando a sessão libera. Cada item: ver completo, editar, reordenar (drena sempre
// do topo) e cancelar só ele. A fila vive no servidor (parked.json).
export function QueuedBanner({ queued, queuedAtts, onCancelQueueAt, onEdit, onMove, held = false, onResume, paused = false, onTogglePause }: {
  queued: string[];
  queuedAtts?: number[];
  onCancelQueueAt: (i: number) => void;
  onEdit: (i: number, text: string) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  held?: boolean;
  onResume?: () => void;
  // Pausa manual da fila (persistida no servidor): trava o drainer até retomar. É
  // distinta do `held` (espera transitória do cancelamento no cliente).
  paused?: boolean;
  onTogglePause?: () => void;
}) {
  const q = useQueuedBanner(queued, onMove, onEdit);
  return (
    <div className="mb-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] px-2.5 py-1.5">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-orange-300/90">
        <Icon name={held ? 'square' : paused ? 'pause' : 'clock'} size={12} className="shrink-0 text-orange-400/80" />
        {held
          ? `fila em espera (${queued.length}) — segurada pelo cancelamento`
          : paused
          ? `fila pausada (${queued.length}) — não vai enviar até retomar`
          : queued.length === 1 ? 'na fila' : `${queued.length} na fila`}
        <div className="ml-auto flex items-center gap-1">
          {held && onResume && (
            <button
              type="button"
              onClick={onResume}
              title="Retomar a fila agora"
              className={`flex h-5 items-center gap-1 rounded border border-orange-500/40 px-1.5 text-[10px] text-orange-300 transition hover:bg-orange-500/15 ${tokens.focusRing}`}
            >
              <Icon name="play" size={9} /> retomar
            </button>
          )}
          {onTogglePause && (
            <button
              type="button"
              onClick={onTogglePause}
              title={paused ? 'Retomar o envio automático da fila' : 'Pausar a fila (nada é enviado até retomar)'}
              className={`flex h-5 items-center gap-1 rounded border px-1.5 text-[10px] transition ${tokens.focusRing} ${paused ? 'border-orange-500/60 bg-orange-500/15 text-orange-200 hover:bg-orange-500/25' : 'border-orange-500/40 text-orange-300 hover:bg-orange-500/15'}`}
            >
              <Icon name={paused ? 'play' : 'pause'} size={9} /> {paused ? 'retomar' : 'pausar'}
            </button>
          )}
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {queued.map((text, i) => (
          <QueuedItem
            key={i}
            index={i}
            text={text}
            atts={queuedAtts?.[i] ?? 0}
            expanded={!!q.open[i]}
            flash={q.flash === i}
            first={i === 0}
            last={i === queued.length - 1}
            editing={q.editing === i}
            draft={q.draft}
            setDraft={q.setDraft}
            onToggle={() => q.toggle(i)}
            onStartEdit={() => q.startEdit(i)}
            onCommit={q.commitEdit}
            onCancelEdit={q.cancelEdit}
            onMove={(dir) => q.move(i, dir)}
            onRemove={() => onCancelQueueAt(i)}
          />
        ))}
      </ul>
    </div>
  );
}
