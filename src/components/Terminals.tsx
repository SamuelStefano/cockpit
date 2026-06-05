import { useEffect, useRef } from 'react';
import { Icon } from './primitives';
import type { Terminal, TerminalLine } from '../data/mock';

const LINE_TONE: Record<TerminalLine['t'], string> = {
  sys:  'text-neutral-600',
  cmd:  'text-orange-400',
  out:  'text-neutral-300',
  ok:   'text-green-400',
  warn: 'text-yellow-400',
  err:  'text-red-400',
};

interface TerminalViewProps {
  term: Terminal;
}

function TerminalView({ term }: TerminalViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [term.lines.length, term.id]);

  return (
    <div
      ref={ref}
      className="scroll-thin flex-1 overflow-y-auto px-3.5 py-3 font-mono text-[12.5px] leading-[1.65]"
      style={{ background: 'var(--term-bg)' }}
    >
      {term.lines.map((l, i) => (
        <div key={i} className={`whitespace-pre-wrap break-words ${LINE_TONE[l.t] || 'text-neutral-300'}`}>
          {l.t === 'cmd' && <span className="select-none text-green-500/80">➜ </span>}
          {l.s || ' '}
        </div>
      ))}
      {term.running && (
        <div className="flex items-center text-neutral-300">
          <span className="select-none text-green-500/80">➜ </span>
          <span className="caret-term" />
        </div>
      )}
    </div>
  );
}

export interface TerminalsPanelProps {
  terminals: Terminal[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
  onToggleRun: (id: string) => void;
  onCloseMobile?: () => void;
}

export function TerminalsPanel({ terminals, activeId, onSelect, onAdd, onClose, onToggleRun, onCloseMobile }: TerminalsPanelProps) {
  const active = terminals.find(t => t.id === activeId) || terminals[0];

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--term-bg)' }}>
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
                <span
                  className={`h-1.5 w-1.5 rounded-full ${t.running ? 'bg-green-500' : 'bg-neutral-600'}`}
                  style={t.running ? { boxShadow: '0 0 6px var(--ok)' } : {}}
                />
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
        </div>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="mb-1.5 ml-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
            <Icon name="chevronDown" size={16} />
          </button>
        )}
      </div>

      {active ? <TerminalView term={active} /> : (
        <div className="flex flex-1 items-center justify-center text-[12px] text-neutral-600">nenhum terminal aberto</div>
      )}

      <div className="flex shrink-0 items-center justify-between border-t border-neutral-800 bg-neutral-950/80 px-3 py-2">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {active?.running ? (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500" style={{ boxShadow: '0 0 6px var(--ok)' }} />
              <span className="text-green-400">running</span>
              <span className="text-neutral-600">pid {active.pid}</span>
              <span className="text-neutral-700">·</span>
              <span className="text-neutral-600">{active.cwd}</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-neutral-600" />
              <span className="text-neutral-500">parado</span>
              {active && <span className="text-neutral-700">· {active.cwd}</span>}
            </>
          )}
        </div>
        {active && (
          <button
            onClick={() => onToggleRun(active.id)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition
              ${active.running
                ? 'border-neutral-700 text-neutral-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400'
                : 'border-neutral-700 text-neutral-300 hover:border-green-500/40 hover:bg-green-500/10 hover:text-green-400'}`}
          >
            <Icon name={active.running ? 'square' : 'play'} size={11} />
            {active.running ? 'parar' : 'iniciar'}
          </button>
        )}
      </div>
    </div>
  );
}
