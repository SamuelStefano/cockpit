import { relReset } from '../../lib/time';
import { ProgressBar, tokens } from '../primitives';
import { UsagePopover } from './UsagePopover';
import { useDismissable } from './useDismissable';
import { usageTone, toneText } from './usage-windows';
import type { PlanUsage } from '../../../shared/protocol';

// Uso GLOBAL do plano (claude.ai/settings/usage) + tempo de reset. SEMPRE à vista
// no header, em qualquer rota (#183): nunca some. Enquanto o número não chega do
// poll OAuth, mostra placeholder ("—") em vez de sumir — assim o indicador é uma
// âncora fixa, não algo que pisca pra fora ao sair do chat. Clicar abre o detalhe
// das outras janelas (semana, Opus), que não cabem no header.
export function UsageBar({ usage, compact }: { usage: PlanUsage | null; compact: boolean }) {
  const { ref, open, setOpen } = useDismissable<HTMLDivElement>();
  const pct = usage ? usage.fiveHour : null;
  const tone = usageTone(pct ?? 0);
  const reset = usage && usage.resetsAt ? relReset(usage.resetsAt) : '';
  const title = usage
    ? `Uso do plano: ${pct}% da janela de 5h consumida${reset ? ` · reseta em ${reset}` : ''} — clique pra ver semana e Opus`
    : 'Uso do plano: lendo da conta…';
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex items-center border bg-neutral-900/60 py-1.5 transition ${tokens.radius.md} ${tokens.focusRing}
          ${open ? 'border-neutral-700' : 'border-neutral-800 hover:border-neutral-700'}
          ${compact ? 'gap-1.5 px-2' : 'gap-2 px-2.5'}`}
      >
        {!compact && <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Usage</span>}
        <div className={compact ? 'w-12' : 'w-20'}>
          <ProgressBar max={100} segments={pct === null ? [] : [{ value: pct, tone }]} />
        </div>
        <span className={`text-[11px] font-medium tabular-nums ${pct === null ? 'text-neutral-500' : toneText[tone]}`}>
          {pct === null ? '—' : `${pct}%`}
        </span>
        {reset && !compact && <span className="text-[10px] tabular-nums text-neutral-500">reset {reset}</span>}
      </button>
      {open && <UsagePopover windows={usage?.windows ?? []} loading={!usage} />}
    </div>
  );
}
