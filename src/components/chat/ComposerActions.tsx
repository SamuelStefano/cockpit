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

const btn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-hidden focus-visible:ring-2';
const idle = 'bg-neutral-800 text-neutral-600';

export function ComposerActions({ busy, paused, hasText, hasAtt, attUploading, onSubmit, onStop }: ComposerActionsProps) {
  if (busy) {
    // O stop vem ANTES e o enfileirar fica no slot da direita — o mesmo lugar onde
    // o enviar mora em repouso. Com a ordem invertida o polegar caía no stop e
    // interrompia o turno em vez de mandar a mensagem. Pelo mesmo motivo o botão de
    // envio é sempre renderizado (desabilitado quando não há o que mandar): some-lo
    // com o composer vazio empurrava o stop de volta pro slot da direita.
    const nothingToSend = !hasText && !hasAtt;
    return (
      <div className="mb-0.5 flex shrink-0 items-center gap-1.5">
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
