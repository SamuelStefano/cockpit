import { useLayoutEffect, useRef, useState } from 'react';
import { Icon, tokens } from '../primitives';
import { remapOpen } from './queued-open';

// Fila do cliente: mensagens digitadas durante um turno, disparadas em ordem
// quando a sessão libera. Cada item: ver completo (clique no texto), reordenar
// (drena sempre do topo) e cancelar só ele. A fila é persistida por sessão no hook.
export function QueuedBanner({ queued, queuedAtts, onCancelQueueAt, onMove, held = false, onResume }: {
  queued: string[];
  queuedAtts?: number[];
  onCancelQueueAt: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  held?: boolean;
  onResume?: () => void;
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [flash, setFlash] = useState<number | null>(null);
  const toggle = (i: number) => setOpen((o) => ({ ...o, [i]: !o[i] }));
  // O expandido é keyed por índice, mas QUALQUER mudança na fila (cancelar,
  // drenar o topo, reordenar) desloca os índices — sem o remap a expansão
  // pulava pro item vizinho. Remapear aqui cobre os três casos de uma vez.
  // Layout effect: corrige antes do paint, senão 1 frame mostrava o vizinho expandido.
  const prevQueued = useRef(queued);
  useLayoutEffect(() => {
    if (prevQueued.current === queued) return;
    setOpen((o) => remapOpen(prevQueued.current, queued, o));
    prevQueued.current = queued;
  }, [queued]);
  // O flash dá feedback de pra onde o item foi (a lista reordena sem animação).
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    onMove(i, dir);
    setFlash(j);
    window.setTimeout(() => setFlash((f) => (f === j ? null : f)), 700);
  };
  const iconBtn = `flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-30 ${tokens.focusRing}`;
  return (
    <div className="mb-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] px-2.5 py-1.5">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-orange-300/90">
        <Icon name={held ? 'square' : 'clock'} size={12} className="shrink-0 text-orange-400/80" />
        {held
          ? `fila em espera (${queued.length}) — segurada pelo cancelamento`
          : queued.length === 1 ? 'na fila' : `${queued.length} na fila`}
        {held && onResume && (
          <button
            type="button"
            onClick={onResume}
            title="Retomar a fila agora"
            className={`ml-auto flex h-5 items-center gap-1 rounded border border-orange-500/40 px-1.5 text-[10px] text-orange-300 transition hover:bg-orange-500/15 ${tokens.focusRing}`}
          >
            <Icon name="play" size={9} /> retomar
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {queued.map((text, i) => {
          const expanded = !!open[i];
          const atts = queuedAtts?.[i] ?? 0;
          return (
            <li key={i} className={`flex items-start gap-1 rounded-md transition-colors duration-500 ${flash === i ? 'bg-orange-500/20' : ''}`}>
              <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-orange-400/50">{i + 1}.</span>
              {atts > 0 && (
                <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-orange-300/80" title={`${atts} anexo${atts > 1 ? 's' : ''} amarrado${atts > 1 ? 's' : ''} a este prompt`}>
                  <Icon name="paperclip" size={10} />{atts > 1 ? atts : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => toggle(i)}
                title={expanded ? 'Recolher' : 'Ver completo'}
                className={`flex-1 rounded text-left text-[11.5px] leading-snug ${tokens.focusRing} ${text ? 'text-neutral-300' : 'italic text-neutral-500'} ${expanded ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
              >
                {text || (atts > 0 ? 'anexo sem texto' : '')}
              </button>
              <div className="flex shrink-0 items-center">
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Subir na fila" className={iconBtn}>
                  <Icon name="chevronUp" size={12} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === queued.length - 1} title="Descer na fila" className={iconBtn}>
                  <Icon name="chevronDown" size={12} />
                </button>
                <button onClick={() => onCancelQueueAt(i)} title="Cancelar esta mensagem na fila" className={iconBtn}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
