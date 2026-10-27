import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Icon, IconButton, tokens } from './primitives';
import type { TerminalClipboardApi } from './useTerminalClipboard';
import type { Terminal } from '../data/types';
import type { TermApi } from '../useCockpit';

// xterm.js são 334 KB que só servem quando existe um terminal aberto. Importado
// direto, ele entrava no grafo estático do entry e o Vite emitia um
// `modulepreload` — ou seja, baixava em TODO carregamento da página, inclusive de
// quem nunca abre o painel. O `lazy` é o que torna verdadeiro o chunk separado que
// o manualChunks do vite.config já declarava.
const XtermView = lazy(() => import('./Xterm').then((m) => ({ default: m.XtermView })));

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
  // "matar" ends the real tmux session (agents run there). On mobile it sits at
  // the bottom of the sheet and was easy to mis-tap: the first tap arms it for 3s.
  const [killArmed, setKillArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!killArmed) return;
    const t = setTimeout(() => setKillArmed(null), 3000);
    return () => clearTimeout(t);
  }, [killArmed]);
  const clipboardRef = useRef<TerminalClipboardApi | null>(null);
  const armOrKill = (id: string) => { if (killArmed === id) { setKillArmed(null); onClose(id); } else setKillArmed(id); };

  return (
    <div className="flex h-full flex-col" style={{ background: '#0a0a0a' }}>
      <div className="flex shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-950/80 px-1.5 pt-1.5">
        <div className="scroll-thin flex flex-1 items-center gap-1 overflow-x-auto pb-1.5">
          {terminals.map((t) => {
            const on = t.id === active?.id;
            const dead = term.exited.has(t.id);
            const armed = killArmed === t.id;
            return (
              <div
                key={t.id}
                className={`group flex shrink-0 items-center rounded-t-md border-b-2 transition
                  ${on
                    ? 'border-orange-500 bg-neutral-900 text-neutral-100'
                    : 'border-transparent text-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300'}`}
              >
                <button onClick={() => onSelect(t.id)} className={`flex items-center gap-1.5 rounded-t-md py-1.5 pl-2.5 pr-1.5 font-mono text-[12px] ${tokens.focusRing}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${dead ? 'bg-neutral-600' : 'bg-green-500'}`} aria-label={dead ? 'encerrado' : 'ativo'} />
                  {t.name}
                </button>
                <span className="flex items-center gap-0.5 pr-1 sm:pointer-fine:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  {on && (
                    <>
                      <IconButton icon="copy" size="xs" label="Copiar" tip="Copia a seleção · Ctrl+Shift+C" onClick={() => void clipboardRef.current?.copy()} />
                      <IconButton icon="clipboard" size="xs" label="Colar" tip="Ctrl+V / Ctrl+Shift+V colam · botão direito" onClick={() => void clipboardRef.current?.paste()} />
                    </>
                  )}
                  <IconButton
                    icon={armed ? 'trash' : 'x'} size="xs"
                    label={armed ? 'Confirmar: fechar terminal' : 'Fechar terminal'}
                    tip={armed ? 'Toque de novo pra encerrar a sessão tmux' : 'Fechar terminal (encerra a sessão tmux)'}
                    className={armed ? 'text-red-400' : ''}
                    onClick={() => armOrKill(t.id)}
                  />
                </span>
              </div>
            );
          })}
            <button
              onClick={onAdd}
              title="Novo terminal"
              aria-label="Novo terminal"
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
                  className="flex shrink-0 items-center gap-1 rounded-md border border-dashed border-neutral-700 px-2 py-1 font-mono text-[12px] text-neutral-500 transition hover:border-orange-500/40 hover:text-orange-300"
                >
                  <Icon name="terminal" size={11} /> {id}
                </button>
              ))}
            </>
          )}
        </div>
        {onCloseMobile && (
          <button onClick={onCloseMobile} title="Fechar terminais" aria-label="Fechar terminais" className="mb-1.5 ml-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
            <Icon name="chevronDown" size={16} />
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {active ? (
          <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[13px] text-neutral-600">abrindo terminal…</div>}>
            <XtermView key={active.id} id={active.id} term={term} clipboardRef={clipboardRef} />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-neutral-600">nenhum terminal aberto</div>
        )}
      </div>
    </div>
  );
}
