import { Icon, tokens } from '../primitives';

interface HistoryControlsProps {
  sessionId: string;
  fullLoaded: boolean;
  truncated?: boolean;
  onOpenFull: (id: string) => void;
  onLoadOlder?: (id: string) => void;
  onOpenSummary?: (id: string) => void;
  setFullLoaded: (v: boolean) => void;
  beforeGrow?: () => void;
}

const base = `flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] transition ${tokens.focusRing}`;
const amber = 'border-amber-700/60 bg-amber-500/10 text-amber-300 hover:border-amber-600 hover:text-amber-200';
const orange = 'border-orange-700/60 bg-orange-500/10 text-orange-300 hover:border-orange-600 hover:text-orange-200';
const quiet = 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300';

// `truncated` = ainda existe conversa mais antiga no arquivo. O botão é repetível:
// cada clique estende a janela em uma página, até chegar ao começo da sessão.
export function HistoryControls({ sessionId, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow }: HistoryControlsProps) {
  return (
    <>
      {truncated && onLoadOlder && (
        <button
          onClick={() => { beforeGrow?.(); setFullLoaded(true); onLoadOlder(sessionId); }}
          title="Carrega mais um trecho do histórico, incluindo mensagens anteriores a um /compact. Pode clicar quantas vezes precisar."
          className={`${base} ${amber}`}
        >
          <Icon name="chevronUp" size={11} />
          carregar antigas
        </button>
      )}
      {fullLoaded ? (
        <button
          onClick={() => { setFullLoaded(false); onOpenSummary?.(sessionId); }}
          title="Volta à visão resumida (só o trecho mais recente da conversa ativa)."
          className={`${base} ${orange}`}
        >
          <Icon name="message" size={11} />
          mostrar resumido
        </button>
      ) : !truncated && (
        <button
          onClick={() => { beforeGrow?.(); setFullLoaded(true); onOpenFull(sessionId); }}
          title="Recarrega todas as mensagens do arquivo, inclusive as que saíram do caminho ativo."
          className={`${base} ${quiet}`}
        >
          <Icon name="message" size={11} />
          ver tudo
        </button>
      )}
    </>
  );
}
