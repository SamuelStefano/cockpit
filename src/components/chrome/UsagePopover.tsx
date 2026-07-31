import { ProgressBar, tokens } from '../primitives';
import { relReset } from '../../lib/time';
import { windowLabel, usageTone, toneText } from './usage-windows';
import type { PlanWindow } from '../../../shared/protocol';

function Row({ w }: { w: PlanWindow }) {
  const tone = usageTone(w.pct);
  const reset = w.resetsAt ? relReset(w.resetsAt) : '';
  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11.5px] text-neutral-300">{windowLabel(w.key)}</span>
        <span className={`text-[11.5px] font-medium tabular-nums ${toneText[tone]}`}>{w.pct}%</span>
      </div>
      <ProgressBar className="mt-1.5" max={100} segments={[{ value: w.pct, tone }]} />
      {reset && <div className="mt-1 text-[10px] tabular-nums text-neutral-500">reseta em {reset}</div>}
    </div>
  );
}

// Detalhe das quotas da conta. O header só cabe a janela de 5h; aqui saem todas
// as que a conta expõe (semana geral, semana Opus/Sonnet, excedente).
export function UsagePopover({ windows, loading }: { windows: PlanWindow[]; loading: boolean }) {
  return (
    <div
      role="dialog"
      aria-label="Uso do plano"
      className={`absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden ${tokens.radius.md} ${tokens.surface.raised}`}
    >
      <div className="border-b border-neutral-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Uso do plano
      </div>
      {windows.length === 0 ? (
        <div className="px-3 py-3 text-[11.5px] text-neutral-500">
          {loading ? 'Lendo os limites da conta…' : 'A conta não informou nenhum limite.'}
        </div>
      ) : (
        <div className="divide-y divide-neutral-800/70">
          {windows.map((w) => <Row key={w.key} w={w} />)}
        </div>
      )}
    </div>
  );
}
