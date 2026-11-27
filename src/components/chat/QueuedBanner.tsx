import type { ModelInfo } from '../../../shared/protocol';
import { Button, Icon } from '../primitives';
import { QueuedItem } from './QueuedItem';
import { useQueuedBanner } from './useQueuedBanner';
import { useNowTick } from './useNowTick';
import { queueStatus, queueStatusIcon, queueStatusLabel } from './queue-status';

// Fila do cliente: mensagens digitadas durante um turno, disparadas em ordem
// quando a sessão libera. Cada item: ver completo, editar, reordenar (drena sempre
// do topo) e cancelar só ele. A fila vive no servidor (parked.json).
export function QueuedBanner({ queued, queuedIds, queuedAtts, queuedModels, models, onRunBg, onRunNow, onCancelQueueAt, onEdit, onMove, held = false, onResume, paused = false, onTogglePause, quotaHeld = false, resetLabel, releaseAt = 0 }: {
  queued: string[];
  // Stable wire id of each item, parallel to `queued`.
  queuedIds: string[];
  queuedAtts?: number[];
  // Disparo em background: modelo com que cada item foi enfileirado + catálogo.
  // Paralelo a `queued` (mesma origem, mesmo tamanho).
  queuedModels: string[];
  models: ModelInfo[];
  onRunBg: (i: number, model: string) => void;
  onRunNow: (i: number) => void;
  onCancelQueueAt: (i: number) => void;
  onEdit: (i: number, text: string) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  held?: boolean;
  onResume?: () => void;
  // Pausa manual da fila (persistida no servidor): trava o drainer até retomar. É
  // distinta do `held` (espera transitória do cancelamento no cliente).
  paused?: boolean;
  onTogglePause?: () => void;
  // Teto de tokens do plano: o drainer do servidor segura sozinho até o reset.
  quotaHeld?: boolean;
  resetLabel?: string | null;
  // Epoch ms em que o cooldown pós-reset acaba e a fila começa a soltar.
  releaseAt?: number;
}) {
  const q = useQueuedBanner(queued, queuedIds, onMove, onEdit);
  const now = useNowTick(releaseAt > Date.now());
  const status = queueStatus({ held, paused, quotaHeld, releaseAt, now });
  return (
    <div className="mb-2 rounded-lg border border-orange-500/30 bg-orange-500/6 px-2.5 py-1.5">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-orange-300/90">
        <Icon name={queueStatusIcon(status)} size={12} className="shrink-0 text-orange-400/80" />
        {queueStatusLabel(status, queued.length, resetLabel, releaseAt, now)}
        <div className="ml-auto flex items-center gap-1">
          {held && onResume && (
            <Button size="xs" variant="outline" icon="play" onClick={onResume} title="Retomar a fila agora">retomar</Button>
          )}
          {onTogglePause && (
            <Button
              size="xs" variant="outline" icon={paused ? 'play' : 'pause'} onClick={onTogglePause}
              title={paused ? 'Retomar o envio automático da fila' : 'Pausar a fila (nada é enviado até retomar)'}
              className={paused ? 'border-orange-500/60 bg-orange-500/15 text-orange-200' : ''}
            >
              {paused ? 'retomar' : 'pausar'}
            </Button>
          )}
        </div>
      </div>
      {/* Capped: on a phone every item takes ~65px (its actions get their own
          row), so 3 queued prompts during a turn left ~80px of thread at 375x667
          and none with the keyboard up. The list scrolls instead. */}
      <ul className="scroll-thin flex max-h-48 flex-col gap-1 overflow-y-auto overscroll-contain pointer-coarse:max-h-[22dvh]">
        {queued.map((text, i) => (
          <QueuedItem
            key={queuedIds[i]}
            index={i}
            text={text}
            atts={queuedAtts?.[i] ?? 0}
            expanded={!!q.open[queuedIds[i]]}
            flash={q.flash === queuedIds[i]}
            first={i === 0}
            last={i === queued.length - 1}
            editing={q.editing === queuedIds[i]}
            draft={q.draft}
            setDraft={q.setDraft}
            onToggle={() => q.toggle(queuedIds[i])}
            onStartEdit={() => q.startEdit(queuedIds[i])}
            onCommit={q.commitEdit}
            onCancelEdit={q.cancelEdit}
            onMove={(dir) => q.move(queuedIds[i], dir)}
            onRemove={() => onCancelQueueAt(i)}
            bgModel={queuedModels[i]}
            models={models}
            bgOpen={q.bgOpen === queuedIds[i]}
            onToggleBg={() => q.toggleBg(queuedIds[i])}
            onRunBg={(m) => onRunBg(i, m)}
            onRunNow={() => onRunNow(i)}
            nowBlocked={paused || quotaHeld || held}
          />
        ))}
      </ul>
    </div>
  );
}
