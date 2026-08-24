import { Icon } from '../primitives';

interface ComposerActionsProps {
  busy: boolean;
  paused: boolean;
  hasText: boolean;
  hasAtt: boolean;
  attUploading: boolean;
  onSubmit: () => void;
  onStop: () => void;
}

const btn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2';
const idle = 'bg-neutral-800 text-neutral-600';

export function ComposerActions({ busy, paused, hasText, hasAtt, attUploading, onSubmit, onStop }: ComposerActionsProps) {
  if (busy) {
    // Com run em curso o envio vira "enfileirar" e ganha botão próprio ao lado do
    // stop: no toque o Enter quebra linha, então sem ele a única forma de mandar a
    // próxima mensagem era interromper o turno atual.
    return (
      <div className="mb-0.5 flex shrink-0 items-center gap-1.5">
        {(hasText || hasAtt) && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={attUploading}
            aria-label="Enfileirar mensagem"
            title={attUploading ? 'Aguarde o anexo terminar de subir' : 'Enfileirar — envia quando o turno atual terminar'}
            className={`${btn} focus-visible:ring-amber-500/40 ${attUploading ? idle : 'bg-amber-500/80 text-neutral-950 hover:bg-amber-400'}`}
          >
            <Icon name="arrowUp" size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={onStop}
          aria-label="Interromper resposta"
          title="Interromper resposta"
          className={`${btn} bg-neutral-800 text-neutral-200 hover:bg-red-500/20 hover:text-red-400 focus-visible:ring-red-500/40`}
        >
          <Icon name="square" size={13} />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={attUploading || (!hasText && !hasAtt)}
      aria-label={paused ? 'Enfileirar mensagem' : 'Enviar mensagem'}
      title={attUploading ? 'Aguarde o anexo terminar de subir' : paused ? 'Enfileirar — envia sozinho quando os tokens resetarem' : undefined}
      className={`${btn} mb-0.5 focus-visible:ring-orange-500/40
        ${attUploading
          ? idle
          : paused
          ? (hasText ? 'bg-amber-500/80 text-neutral-950 hover:bg-amber-400' : idle)
          : (hasText || hasAtt) ? 'bg-orange-500 text-neutral-950 hover:bg-orange-400' : idle}`}
    >
      <Icon name={paused ? 'clock' : 'arrowUp'} size={paused ? 14 : 16} />
    </button>
  );
}
