import { useMemo, useState } from 'react';
import { Icon } from '../../components/primitives';
import type { DailyUsage } from '../../../shared/protocol';
import { fmtNum as fmt, usd, startOfDay } from '../observatorio.format';
import { filterSeries, type TrendPeriod } from './trend-filter';

const PERIODS: { id: TrendPeriod; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'tudo' },
];

export function Trend({ series }: { series: DailyUsage[] }) {
  const [period, setPeriod] = useState<TrendPeriod>('all');
  const shown = useMemo(() => filterSeries(series, period), [series, period]);
  const dayLabel = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const max = Math.max(1, ...shown.map((d) => d.cost));
  const totalCost = shown.reduce((a, d) => a + d.cost, 0);
  const today = startOfDay(Date.now());

  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-500">
          <Icon name="zap" size={12} /> custo por dia
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium transition ${period === p.id ? 'border-orange-500/40 bg-orange-500/15 text-orange-300' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] text-emerald-400/80">{usd(totalCost)}</span>
        </div>
      </div>
      <div className="flex h-24 items-end gap-1">
        {shown.map((d, i) => {
          // Escala sqrt: um dia outlier (ex.: $900) esmagava o resto pra 2px na
          // escala linear. Altura em px absoluto: % não resolvia (pai sem altura
          // definida) e todas as barras caíam no minHeight.
          const h = Math.max(4, Math.round(Math.sqrt(d.cost / max) * 76));
          const isToday = d.day === today;
          // Com muitas barras (período "tudo") os rótulos colidiam — mostra 1 a cada N.
          const labelStep = Math.ceil(shown.length / 12);
          const showLabel = i % labelStep === 0 || isToday;
          return (
            <div key={d.day} className="group/bar flex flex-1 flex-col items-center justify-end gap-1">
              <div className="relative flex w-full justify-center">
                <div
                  className={`w-full max-w-[18px] rounded-sm transition-colors ${isToday ? 'bg-orange-500' : 'bg-orange-500/40 group-hover/bar:bg-orange-500/70'}`}
                  style={{ height: `${h}px` }}
                  title={`${dayLabel(d.day)} · ${usd(d.cost)} · ${fmt(d.output)} out`}
                />
              </div>
              <span className={`text-[8.5px] tabular-nums ${isToday ? 'font-semibold text-orange-400' : 'text-neutral-600'} ${showLabel ? '' : 'invisible'}`}>{new Date(d.day).getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
