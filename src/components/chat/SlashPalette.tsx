import { isLocalSlash, slashHint } from './slash';

interface SlashPaletteProps {
  matches: string[];
  sel: number;
  setSel: (i: number) => void;
  complete: (cmd: string) => void;
}

export function SlashPalette({ matches, sel, setSel, complete }: SlashPaletteProps) {
  return (
    <div className="scroll-thin absolute bottom-full left-0 z-30 mb-2 max-h-60 w-full overscroll-contain overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl shadow-black/50">
      {matches.map((c, i) => {
        const local = isLocalSlash(c);
        return (
          <button
            key={c}
            onMouseDown={(e) => { e.preventDefault(); complete(c); }}
            onMouseEnter={() => setSel(i)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${i === sel ? 'bg-orange-500/15' : ''}`}
          >
            <span className={`font-mono text-[12.5px] ${i === sel ? 'text-orange-200' : 'text-neutral-300'}`}>
              <span className="text-neutral-600">/</span>{c}
            </span>
            {local && (
              <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-300/90">app</span>
            )}
            <span className="ml-auto truncate text-[10.5px] text-neutral-500">{slashHint(c)}</span>
          </button>
        );
      })}
    </div>
  );
}
