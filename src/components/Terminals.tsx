import { Icon } from './primitives';
import { XtermView } from './Xterm';
import type { Terminal } from '../data/mock';
import type { TermApi } from '../useCockpit';

export interface TerminalsPanelProps {
  terminals: Terminal[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
  term: TermApi;
  attachable?: string[];
  onAttach?: (id: string) => void;
  onCloseMobile?: () => void;
}

export function TerminalsPanel({ terminals, activeId, onSelect, onAdd, onClose, term, attachable = [], onAttach, onCloseMobile }: TerminalsPanelProps) {
  const active = terminals.find((t) => t.id === activeId) || terminals[0];

  return (
    <div className="flex h-full flex-col" style={{ background: '#0a0a0a' }}>
      <div className="flex shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-950/80 px-1.5 pt-1.5">
        <div className="scroll-thin flex flex-1 items-center gap-1 overflow-x-auto pb-1.5">
          {terminals.map((t) => {
            const on = t.id === active?.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`group flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-2.5 py-1.5 font-mono text-[11.5px] transition
                  ${on
                    ? 'border-orange-500 bg-neutral-900 text-neutral-100'
                    : 'border-transparent text-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300'}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" style={{ boxShadow: '0 0 6px var(--ok)' }} />
                {t.name}
                {terminals.length > 1 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
                    className="-mr-1 ml-0.5 rounded p-0.5 text-neutral-600 opacity-0 transition hover:bg-neutral-800 hover:text-neutral-300 group-hover:opacity-100"
                  >
                    <Icon name="x" size={11} />
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={onAdd}
            title="Novo terminal"
            className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-900 hover:text-orange-400"
          >
            <Icon name="plus" size={14} />
          </button>
          {attachable.length > 0 && onAttach && (
            <>
              <span className="mx-1 h-4 w-px shrink-0 bg-neutral-800" />
              {attachable.map((id) => (
                <button
                  key={id}
                  onClick={() => onAttach(id)}
                  title={`Reanexar sessão tmux cockpit-${id}`}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-dashed border-neutral-700 px-2 py-1 font-mono text-[11px] text-neutral-500 transition hover:border-orange-500/40 hover:text-orange-300"
                >
                  <Icon name="terminal" size={11} /> {id}
                </button>
              ))}
            </>
          )}
        </div>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="mb-1.5 ml-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
            <Icon name="chevronDown" size={16} />
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {active ? (
          <XtermView key={active.id} id={active.id} term={term} />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-neutral-600">nenhum terminal aberto</div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-neutral-800 bg-neutral-950/80 px-3 py-1.5">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="h-2 w-2 rounded-full bg-green-500" style={{ boxShadow: '0 0 6px var(--ok)' }} />
          <span className="text-green-400">tmux</span>
          {active && <span className="text-neutral-600">cockpit-{active.id}</span>}
        </div>
        {active && (
          <button
            onClick={() => onClose(active.id)}
            title="Encerra a sessão tmux"
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1 text-[11px] font-medium text-neutral-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
          >
            <Icon name="trash" size={11} /> matar
          </button>
        )}
      </div>
    </div>
  );
}
