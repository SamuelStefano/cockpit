import { tokens } from '../primitives';
import type { PermMode } from '../../../shared/protocol';

const ACTIVE_TONE: Record<PermMode, string> = {
  plan: 'bg-neutral-800 text-neutral-100',
  auto: `bg-amber-500/20 text-amber-300 ${tokens.insetRing.warn}`,
  acceptEdits: `bg-orange-500/20 text-orange-300 ${tokens.insetRing.accent}`,
};

export function ModeToggle({ mode, setMode }: { mode: PermMode; setMode: (m: PermMode) => void }) {
  const opts: { v: PermMode; label: string; hint: string }[] = [
    { v: 'plan', label: 'Planejar', hint: 'só descreve o plano — nada é executado' },
    { v: 'acceptEdits', label: 'Executar', hint: 'o agente edita arquivos e roda comandos' },
    { v: 'auto', label: 'Auto', hint: 'roda o ciclo sozinho — edita arquivos e usa o shell' },
  ];
  return (
    <div className="inline-flex shrink-0 items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5">
      {opts.map((o) => {
        const active = mode === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setMode(o.v)}
            title={o.hint}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-medium transition sm:px-2 sm:py-1 ${tokens.focusRing}
              ${active ? ACTIVE_TONE[o.v] : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
