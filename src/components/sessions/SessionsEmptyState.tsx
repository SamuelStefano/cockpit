import { Icon, Button } from '../primitives';

interface SessionsEmptyStateProps {
  hasSessions: boolean;
  query: string;
  tagFilter: string | null;
  onNew: () => void;
  onCloseMobile?: () => void;
  // A dead-end "nothing found" had no way back but erasing the box by hand.
  onClear?: () => void;
}

export function SessionsEmptyState({ hasSessions, query, tagFilter, onNew, onCloseMobile, onClear }: SessionsEmptyStateProps) {
  if (!hasSessions) {
    return (
      <div className="mt-10 flex flex-col items-center px-4 text-center">
        <div className="hairline mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-linear-to-b from-neutral-900 to-neutral-950 text-orange-500/60">
          <Icon name="message" size={18} />
        </div>
        <p className="text-[12.5px] font-medium text-neutral-400">Nenhuma sessão ainda</p>
        <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">Crie uma para começar a conversar com o agente.</p>
        <Button size="sm" icon="plus" className="mt-3" onClick={() => { onNew(); onCloseMobile?.(); }}>
          Criar sessão
        </Button>
      </div>
    );
  }
  if (tagFilter && !query) {
    return (
      <div className="mt-8 text-center text-[12px] text-neutral-600">
        Nenhuma sessão com <span className="text-sky-300/80">#{tagFilter}</span>
        {onClear && <div className="mt-2"><Button variant="ghost" size="sm" icon="x" onClick={onClear}>limpar filtro</Button></div>}
      </div>
    );
  }
  return (
    <div className="mt-8 text-center text-[12px] text-neutral-600">
      Nada encontrado para <span className="text-neutral-400">"{query}"</span>{tagFilter && <> em <span className="text-sky-300/80">#{tagFilter}</span></>}
      {onClear && <div className="mt-2"><Button variant="ghost" size="sm" icon="x" onClick={onClear}>limpar busca</Button></div>}
    </div>
  );
}
