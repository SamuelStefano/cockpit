import { tokens } from '../primitives';
import type { PermMode } from '../../../shared/protocol';

const ACTIVE_TONE: Record<PermMode, string> = {
  plan: 'bg-neutral-800 text-neutral-100',
  auto: 'bg-amber-500/20 text-amber-300 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.4)]',
  acceptEdits: 'bg-orange-500/20 text-orange-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.4)]',
};

export function ModeToggle({ mode, setMode, disabled }: { mode: PermMode; setMode: (m: PermMode) => void; disabled: boolean }) {
  const opts: { v: PermMode; label: string; hint: string }[] = [
    { v: 'plan', label: 'Planejar', hint: 'só descreve o plano — nada é executado' },
    { v: 'acceptEdits', label: 'Executar', hint: 'o agente edita arquivos e roda comandos' },
    { v: 'auto', label: 'Auto', hint: 'edita e lê arquivos sozinho — sem rodar comandos no shell' },
  ];
  return (
    <div className="inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5">
      {opts.map((o) => {
        const active = mode === o.v;
        return (
          <button
            key={o.v}
            type="button"
            disabled={disabled}
            onClick={() => setMode(o.v)}
            title={o.hint}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tokens.focusRing}
              ${active ? ACTIVE_TONE[o.v] : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
