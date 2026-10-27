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

// Rows of the header "…" menu; the visible text and the aria-label stay in sync.
const row = `flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-neutral-100 transition-colors hover:bg-neutral-800 pointer-coarse:h-11 ${tokens.focusRing}`;

// `truncated` = ainda existe conversa mais antiga no arquivo. O botão é repetível:
// cada clique estende a janela em uma página, até chegar ao começo da sessão.
export function HistoryControls({ sessionId, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow }: HistoryControlsProps) {
  return (
    <>
      {truncated && onLoadOlder && (
        <button
          onClick={() => { beforeGrow?.(); setFullLoaded(true); onLoadOlder(sessionId); }}
          title="Carrega mais um trecho do histórico, incluindo mensagens anteriores a um /compact. Pode clicar quantas vezes precisar."
          aria-label="Carregar mensagens antigas"
          className={row}
        >
          <Icon name="chevronUp" size={14} />
          Carregar antigas
        </button>
      )}
      {fullLoaded ? (
        <button
          onClick={() => { setFullLoaded(false); onOpenSummary?.(sessionId); }}
          title="Volta à visão resumida (só o trecho mais recente da conversa ativa)."
          aria-label="Mostrar resumido"
          className={row}
        >
          <Icon name="message" size={14} />
          Mostrar resumido
        </button>
      ) : !truncated && (
        <button
          onClick={() => { beforeGrow?.(); setFullLoaded(true); onOpenFull(sessionId); }}
          title="Recarrega todas as mensagens do arquivo, inclusive as que saíram do caminho ativo."
          aria-label="Ver todas as mensagens"
          className={row}
        >
          <Icon name="rotate" size={14} />
          Ver conversa inteira
        </button>
      )}
    </>
  );
}
