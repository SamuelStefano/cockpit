import { Icon } from '../primitives';

// Aviso de versão nova pra PWA instalada, que nunca recarrega sozinha. Não bloqueia
// nada: um turno pode estar rodando, e recarregar no meio dele é decisão do dono.
export function UpdateNotice({ show, onApply, onDismiss }: { show: boolean; onApply: () => void; onDismiss: () => void }) {
  if (!show) return null;
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-2.5 z-40 w-[min(92vw,30rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-sky-500/30 bg-sky-500/12 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-md">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
          <Icon name="check" size={13} />
        </span>
        <p className="min-w-0 flex-1 text-[12px] leading-tight text-sky-100">
          Versão nova do Deck disponível.
          <span className="block text-[11px] text-sky-200/70">Recarregue quando puder — um turno em andamento não é interrompido antes disso.</span>
        </p>
        <button
          type="button"
          onClick={onApply}
          className="shrink-0 rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11.5px] font-medium text-sky-100 transition hover:bg-sky-500/25"
        >
          Recarregar
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar"
          className="shrink-0 rounded-md p-1 text-sky-200/60 transition hover:text-sky-100"
        >
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  );
}
