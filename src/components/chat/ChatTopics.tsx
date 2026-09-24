import { tokens } from '../primitives';
import type { ChatTopic } from './chat-topics';
import { useDismiss } from './useDismiss';

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
  // Opened by tap on a phone there is no mouseleave to close it: Esc and a tap outside do.
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  if (topics.length === 0) return null;
  return (
    <div
      ref={ref}
      // Spans the thread (inset-y-2) and centers the rail in it, instead of being
      // centered on its own height: one mark per prompt, so a long session's rail
      // (80 prompts ≈ 570px) ran over the chat header's buttons and the composer.
      // The wrapper lets clicks through; only the rail and the list take them.
      className="group/topics pointer-events-none absolute inset-y-2 right-0 z-10 flex items-center print:hidden"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Tópicos da conversa (${topics.length})`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`pointer-events-auto flex max-h-full flex-col items-end overflow-hidden px-2 py-2 ${tokens.focusRing} rounded-md`}
      >
        {/* Each mark is a 7px slot that may shrink: when there are more prompts
            than room, the rail compresses instead of overflowing. */}
        {topics.map((t) => (
          <span key={t.id} className="flex min-h-px shrink basis-[7px] items-center overflow-hidden">
            <span className={`block h-[2px] rounded-full transition-all duration-200 ${t.id === activeId ? 'w-4 bg-orange-400' : 'w-2.5 bg-neutral-700 group-hover/topics:bg-neutral-600'}`} />
          </span>
        ))}
      </button>
      {/* Capped at the thread, but never below 12rem: in a short thread (a tall
          composer, 1440x500) max-h-full left a 43px list showing one prompt. */}
      {open && (
        <nav aria-label="Tópicos da conversa" className={`fade-up pointer-events-auto absolute right-full top-1/2 mr-1 flex max-h-[max(100%,12rem)] w-60 max-w-[70vw] -translate-y-1/2 flex-col overflow-hidden ${tokens.radius.lg} ${tokens.surface.raised} py-1.5`}>
          <div className="scroll-thin max-h-[60vh] min-h-0 overflow-y-auto">
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
