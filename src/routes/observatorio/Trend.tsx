import { useMemo, useState } from 'react';
import { Icon, tokens } from '../../components/primitives';
import type { DailyUsage } from '../../../shared/protocol';
import { fmtNum as fmt, startOfDay } from '../observatorio-format';
import { fmtCost } from '../../../shared/format';
import { filterSeries, fillGaps, type TrendPeriod } from './trend-filter';
import { CRON_TZ } from '../../../shared/cron-schedule';

// Buckets are Brasília midnights: label them in that zone, not the browser's, or a
// browser west of UTC-3 labels every bar one day early.
const DAY_FMT = new Intl.DateTimeFormat('pt-BR', { timeZone: CRON_TZ, day: 'numeric', month: 'numeric' });
const DAY_NUM = new Intl.DateTimeFormat('pt-BR', { timeZone: CRON_TZ, day: 'numeric' });
export const dayLabel = (ts: number) => DAY_FMT.format(ts);
export const dayNum = (ts: number) => DAY_NUM.format(ts);

const PERIODS: { id: TrendPeriod; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'tudo' },
];

export function Trend({ series }: { series: DailyUsage[] }) {
  const [period, setPeriod] = useState<TrendPeriod>('all');
  // Tapped bar: a phone has no hover, so the `title` tooltip never showed. The
  // header readout swaps the period total for the picked day until tapped again.
  const [picked, setPicked] = useState<number | null>(null);
  const shown = useMemo(() => fillGaps(filterSeries(series, period)), [series, period]);
  const pickedDay = picked === null ? undefined : shown.find((d) => d.day === picked);
  const max = Math.max(1, ...shown.map((d) => d.cost));
  const totalCost = shown.reduce((a, d) => a + d.cost, 0);
  const today = startOfDay(Date.now());

  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] uppercase tracking-wider text-neutral-500">
          <Icon name="zap" size={12} /> custo por dia
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                aria-pressed={period === p.id}
                className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium transition pointer-coarse:px-2.5 pointer-coarse:py-1.5 ${period === p.id ? 'border-orange-500/40 bg-orange-500/15 text-orange-300' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {pickedDay
            ? <span className="whitespace-nowrap font-mono text-[11px] text-neutral-300" aria-live="polite">{dayLabel(pickedDay.day)} · <span className="text-emerald-400/80">{fmtCost(pickedDay.cost)}</span><span className="hidden sm:inline"> · {fmt(pickedDay.output)} out</span></span>
            : <span className="font-mono text-[11px] text-emerald-400/80">{fmtCost(totalCost)}</span>}
        </div>
      </div>
      {/* gap-0.5 + min-w-0 below sm: 30 bars at gap-1 with each column as wide as
          its day label came to ~416px and ran out of the card on a 390px phone. */}
      <div className="flex h-24 items-end gap-0.5 sm:gap-1">
        {shown.map((d, i) => {
          // Escala sqrt: um dia outlier (ex.: $900) esmagava o resto pra 2px na
          // escala linear. Altura em px absoluto: % não resolvia (pai sem altura
          // definida) e todas as barras caíam no minHeight.
          // A day with no spend gets a 1px baseline, not the 4px floor that made
          // "$0" look the same as a small day.
          const h = d.cost > 0 ? Math.max(4, Math.round(Math.sqrt(d.cost / max) * 76)) : 1;
          const isToday = d.day === today;
          // Com muitas barras (período "tudo") os rótulos colidiam — mostra 1 a cada N.
          const labelStep = Math.ceil(shown.length / 12);
          const showLabel = i % labelStep === 0 || isToday;
          return (
            // The whole column is the target (full chart height), not the bar:
            // a $0 day's bar is 1px tall.
            <button
              key={d.day}
              type="button"
              onClick={() => setPicked((p) => (p === d.day ? null : d.day))}
              aria-pressed={picked === d.day}
              aria-label={`${dayLabel(d.day)} · ${fmtCost(d.cost)} · ${fmt(d.output)} out`}
              title={`${dayLabel(d.day)} · ${fmtCost(d.cost)} · ${fmt(d.output)} out`}
              className={`group/bar flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-xs ${tokens.focusRing}`}
            >
              <div
                className={`w-full max-w-[18px] rounded-xs transition-colors ${d.cost <= 0 ? 'bg-neutral-700' : picked === d.day ? 'bg-orange-300' : isToday ? 'bg-orange-500' : 'bg-orange-500/40 group-hover/bar:bg-orange-500/70'}`}
                style={{ height: `${h}px` }}
              />
              <span className={`whitespace-nowrap text-[8.5px] tabular-nums ${isToday ? 'font-semibold text-orange-400' : 'text-neutral-600'} ${showLabel ? '' : 'invisible'}`}>{dayNum(d.day)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
