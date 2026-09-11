import { Badge } from '../../components/primitives';
import { TIMELINE_WINDOW_MS, type CronSlot } from './cron-timeline';
import { fmtClock, fmtHour } from './cron-format';

const TICK_HOURS = [0, 6, 12, 18, 24];
const HOUR = 60 * 60_000;

const offsetPct = (at: number, now: number) => ((at - now) / TIMELINE_WINDOW_MS) * 100;
const tickAlign = (i: number) => (i === 0 ? '' : i === TICK_HOURS.length - 1 ? '-translate-x-full' : '-translate-x-1/2');

export function CronTimeline({ slots, now }: { slots: CronSlot[]; now: number }) {
  if (slots.length === 0) return null;
  const clashing = slots.filter((s) => s.clash);
  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3.5 pb-2.5 pt-3 hairline">
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-500">Próximas 24h</span>
        <span className="text-[11px] tabular-nums text-neutral-600">{slots.length} disparo{slots.length === 1 ? '' : 's'}</span>
        {clashing.length > 0 && <Badge tone="yellow" dot className="ml-auto">{clashing.length} colados</Badge>}
      </div>
      <div className="relative mt-3 h-4">
        <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-800" />
        {slots.map((s) => (
          <span
            key={`${s.cronId}-${s.at}`}
            title={`${s.name} · ${fmtClock(s.at, now)}`}
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-neutral-900 ${s.clash ? 'bg-yellow-400' : 'bg-orange-400'}`}
            style={{ left: `${offsetPct(s.at, now)}%` }}
          />
        ))}
      </div>
      <div className="relative mt-1 h-3.5 text-[10px] tabular-nums text-neutral-600">
        {TICK_HOURS.map((h, i) => (
          <span key={h} className={`absolute ${tickAlign(i)}`} style={{ left: `${(h / 24) * 100}%` }}>{fmtHour(now + h * HOUR)}</span>
        ))}
      </div>
      {clashing.length > 0 && (
        <p className="mt-1.5 text-[11px] text-yellow-300/80">
          A menos de 15min um do outro, dividindo a janela de cota: {clashing.map((s) => `${s.name} ${fmtHour(s.at)}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
