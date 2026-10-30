import { Icon, IconButton } from '../primitives';
import type { Mic } from './mic-types';

interface ComposerActionsProps {
  busy: boolean;
  paused: boolean;
  hasText: boolean;
  hasAtt: boolean;
  attUploading: boolean;
  onSubmit: () => void;
  onStop: () => void;
  mic?: Mic;
}

// 44px on touch: the one primary action must be an easy target.
const btn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-hidden focus-visible:ring-2';
const idle = 'bg-neutral-800 text-neutral-600';
const chunk = 'btn-chunk bg-orange-500 text-neutral-950 hover:bg-orange-400';

function BusyActions({ hasText, hasAtt, attUploading, onSubmit, onStop }: ComposerActionsProps) {
  // Stop comes BEFORE and enqueue sits in the right slot, where send lives at rest.
  // With the order reversed the thumb landed on stop and interrupted the turn. For
  // the same reason enqueue is always rendered (disabled when empty): hiding it
  // pushed stop back into the right slot.
  const nothingToSend = !hasText && !hasAtt;
  return (
    <div className="flex shrink-0 items-center gap-1.5 pointer-coarse:gap-3">
      <button
        type="button"
        onClick={onStop}
        aria-label="Interromper resposta"
        title="Interromper resposta"
        className={`${btn} bg-neutral-800 text-neutral-200 hover:bg-red-500/20 hover:text-red-400 focus-visible:ring-red-500/40`}
      >
        <Icon name="square" size={13} />
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={attUploading || nothingToSend}
        aria-label="Enfileirar mensagem"
        title={attUploading ? 'Aguarde o anexo terminar de subir' : 'Enfileirar — envia quando o turno atual terminar'}
        className={`${btn} focus-visible:ring-amber-500/40 ${attUploading || nothingToSend ? idle : 'bg-amber-500/80 text-neutral-950 hover:bg-amber-400'}`}
      >
        <Icon name="arrowUp" size={16} />
      </button>
    </div>
  );
}

function MicButton({ mic }: { mic: Mic }) {
  if (mic.listening) {
    return (
      <button type="button" onClick={mic.toggle} aria-label="Parar de ditar" title="Parar de ditar" className={`${btn} animate-pulse bg-red-500/20 text-red-400 focus-visible:ring-red-500/40`}>
        <Icon name="mic" size={16} />
      </button>
    );
  }
  return <IconButton icon="mic" label="Ditar por voz" tip={mic.error ?? 'Ditar por voz'} onClick={mic.toggle} className="rounded-full" />;
}

function PrimaryAction({ paused, hasText, hasAtt, attUploading, onSubmit }: ComposerActionsProps) {
  const canSend = hasText || hasAtt;
  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={attUploading || !canSend}
      aria-label={paused ? 'Enfileirar mensagem' : 'Enviar mensagem'}
      title={attUploading ? 'Aguarde o anexo terminar de subir' : paused ? 'Enfileirar — envia sozinho quando os tokens resetarem' : undefined}
      className={`${btn} press-spring focus-visible:ring-orange-500/40
        ${attUploading
          ? idle
          : paused
          ? (hasText ? 'bg-amber-500/80 text-neutral-950 hover:bg-amber-400' : idle)
          : canSend ? chunk : idle}`}
    >
      <Icon name={paused ? 'clock' : 'arrowUp'} size={paused ? 16 : 19} />
    </button>
  );
}

export function ComposerActions(props: ComposerActionsProps) {
  if (props.busy) return <BusyActions {...props} />;
  return (
    <div className="flex shrink-0 items-center gap-1 pointer-coarse:gap-2">
      {props.mic?.supported && <MicButton mic={props.mic} />}
      <PrimaryAction {...props} />
    </div>
  );
}
