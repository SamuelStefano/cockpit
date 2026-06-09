import { relReset } from '../../lib/time';
import type { PlanUsage } from '../../../shared/protocol';

// Uso GLOBAL do plano (claude.ai/settings/usage) + tempo de reset. SEMPRE à vista
// no header, em qualquer rota (#183): nunca some. Enquanto o número não chega do
// poll OAuth, mostra placeholder ("—") em vez de sumir — assim o indicador é uma
// âncora fixa, não algo que pisca pra fora ao sair do chat.
export function UsageBar({ usage, compact }: { usage: PlanUsage | null; compact: boolean }) {
  const pct = usage ? usage.fiveHour : null;
  const high = pct !== null && pct >= 90;
  const mid = pct !== null && pct >= 70;
  const bar = pct === null ? 'bg-neutral-700' : high ? 'bg-red-500' : mid ? 'bg-amber-500' : 'bg-emerald-500';
  const text = pct === null ? 'text-neutral-500' : high ? 'text-red-300' : mid ? 'text-amber-300' : 'text-emerald-300';
  const reset = usage && usage.resetsAt ? relReset(usage.resetsAt) : '';
  const title = usage
    ? `Uso do plano: ${pct}% da janela de 5h consumida${reset ? ` · reseta em ${reset}` : ''} · 7 dias: ${usage.sevenDay}%`
    : 'Uso do plano: lendo da conta…';
  return (
    <div
      title={title}
      className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Usage</span>
      <div className={`${compact ? 'w-12' : 'w-20'} h-2 overflow-hidden rounded-full bg-neutral-800`}>
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <span className={`text-[11px] font-medium tabular-nums ${text}`}>{pct === null ? '—' : `${pct}%`}</span>
      {reset && !compact && (
        <span className="text-[10px] tabular-nums text-neutral-500" title="Reset da janela de 5h">
          reset {reset}
        </span>
      )}
    </div>
  );
}
