import { Icon } from '../primitives';

interface SessionsEmptyStateProps {
  hasSessions: boolean;
  query: string;
  tagFilter: string | null;
  onNew: () => void;
  onCloseMobile?: () => void;
}

export function SessionsEmptyState({ hasSessions, query, tagFilter, onNew, onCloseMobile }: SessionsEmptyStateProps) {
  if (!hasSessions) {
    return (
      <div className="mt-10 flex flex-col items-center px-4 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
          <Icon name="message" size={18} />
        </div>
        <p className="text-[12.5px] font-medium text-neutral-400">Nenhuma sessão ainda</p>
        <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">Crie uma para começar a conversar com o agente.</p>
        <button onClick={() => { onNew(); onCloseMobile?.(); }} className="mt-3 flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-[12px] font-semibold text-neutral-950 transition hover:bg-orange-400">
          <Icon name="plus" size={14} /> Criar sessão
        </button>
      </div>
    );
  }
  if (tagFilter && !query) {
    return (
      <div className="mt-8 text-center text-[12px] text-neutral-600">
        Nenhuma sessão com <span className="text-sky-300/80">#{tagFilter}</span>
      </div>
    );
  }
  return (
    <div className="mt-8 text-center text-[12px] text-neutral-600">
      Nada encontrado para <span className="text-neutral-400">"{query}"</span>
    </div>
  );
}
