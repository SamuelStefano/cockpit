import { tokens } from '../primitives';
import type { ChatTopic } from './chat-topics';

interface ChatTopicsProps {
  topics: ChatTopic[];
  activeId: string | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onJump: (id: string) => void;
}

// Navegador de tópicos da conversa: em repouso é só um trilho de traços na borda
// direita (um por prompt, o corrente em laranja). Passar o mouse — ou tocar, no
// celular — abre a lista com os títulos. Fora disso não ocupa nada da thread.
export function ChatTopics({ topics, activeId, open, setOpen, onJump }: ChatTopicsProps) {
  if (topics.length === 0) return null;
  return (
    <div
      className="group/topics absolute right-0 top-1/2 z-10 -translate-y-1/2 print:hidden"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Tópicos da conversa (${topics.length})`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex flex-col items-end gap-[5px] px-2 py-2 ${tokens.focusRing} rounded-md`}
      >
        {topics.map((t) => (
          <span key={t.id} className={`block h-[2px] rounded-full transition-all duration-200 ${t.id === activeId ? 'w-4 bg-orange-400' : 'w-2.5 bg-neutral-700 group-hover/topics:bg-neutral-600'}`} />
        ))}
      </button>
      {open && (
        <nav aria-label="Tópicos da conversa" className={`fade-up absolute right-full top-1/2 mr-1 w-60 max-w-[70vw] -translate-y-1/2 overflow-hidden ${tokens.radius.lg} ${tokens.surface.raised} py-1.5`}>
          <div className="scroll-thin max-h-[60vh] overflow-y-auto">
            {topics.map((t, i) => {
              const current = t.id === activeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onJump(t.id)}
                  aria-current={current ? 'true' : undefined}
                  className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[12.5px] leading-snug transition hover:bg-neutral-800 ${tokens.focusRing} ${current ? 'text-neutral-50' : 'text-neutral-400'}`}
                >
                  <span className={`shrink-0 font-mono text-[10px] tabular-nums ${current ? 'text-orange-400' : 'text-neutral-600'}`}>{i + 1}</span>
                  <span className="line-clamp-2">{t.title}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
