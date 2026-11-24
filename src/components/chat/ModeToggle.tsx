import { tokens } from '../primitives';
import type { PermMode } from '../../../shared/protocol';

const OPTS: { v: PermMode; label: string; hint: string }[] = [
  { v: 'plan', label: 'Planejar', hint: 'só descreve o plano' },
  { v: 'acceptEdits', label: 'Executar', hint: 'edita arquivos e roda comandos' },
  { v: 'auto', label: 'Sozinho', hint: 'segue o ciclo até o fim' },
];

export function ModeToggle({ mode, setMode }: { mode: PermMode; setMode: (m: PermMode) => void }) {
  return (
    <div className="flex w-full items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5">
      {OPTS.map((o) => {
        const active = mode === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setMode(o.v)}
            title={o.hint}
            aria-pressed={active}
            className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 pointer-coarse:min-h-11 text-[12px] font-medium transition ${tokens.focusRing}
              ${active ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
