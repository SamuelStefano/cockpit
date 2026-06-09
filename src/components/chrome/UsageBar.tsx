import { fmtReset } from '../../lib/format';
import type { PlanUsage } from '../../../shared/protocol';

// Uso GLOBAL do plano (claude.ai/settings/usage), não contexto de chat: a % da
// quota de prompts já consumida na janela de 5h. Sempre à vista no header.
export function UsageBar({ usage, compact }: { usage: PlanUsage | null; compact: boolean }) {
  if (!usage) return null;
  const pct = usage.fiveHour;
  const high = pct >= 90, mid = pct >= 70;
  const bar = high ? 'bg-red-500' : mid ? 'bg-amber-500' : 'bg-emerald-500';
  const text = high ? 'text-red-300' : mid ? 'text-amber-300' : 'text-emerald-300';
  const reset = fmtReset(usage.resetsAt);
  return (
    <div
      title={`Uso do plano: ${pct}% da janela de 5h consumida${reset ? ` · reseta ${reset}` : ''} · 7 dias: ${usage.sevenDay}%`}
      className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Usage</span>
      <div className={`${compact ? 'w-16' : 'w-24'} h-2 overflow-hidden rounded-full bg-neutral-800`}>
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-medium tabular-nums ${text}`}>{pct}%</span>
    </div>
  );
}
