import type { SysStats } from '../../../../shared/protocol';
import { meterTone, vpsMeters } from '../../status-bar-format';

// The old StatusBar's telemetry, now the lower half of the usage popover.
export function VpsMeters({ stats }: { stats: SysStats | null }) {
  return (
    <div className="border-t border-neutral-800 p-3.5">
      <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">VPS</p>
      {!stats ? (
        <p className="text-[12px] text-neutral-600">lendo telemetria…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {vpsMeters(stats).map((m) => (
            <li key={m.id} role="group" aria-label={`${m.label} ${Math.round(m.pct)}% · ${m.detail}`} className="flex items-center gap-2 text-[12px]">
              <span className="w-12 shrink-0 text-neutral-400">{m.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
                <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, Math.min(100, m.pct))}%`, background: meterTone(m.pct) }} />
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-neutral-300">{Math.round(m.pct)}%</span>
              <span className="w-20 shrink-0 truncate text-neutral-600">{m.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {stats?.saturated && (
        <p className="mt-2.5 flex items-center gap-1.5 rounded-sm bg-red-500/15 px-1.5 py-1 text-[12px] text-red-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
          carga alta há {stats.saturated.seconds}s
        </p>
      )}
    </div>
  );
}
