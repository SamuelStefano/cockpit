import { Icon } from '../../components/primitives';
import type { DailyUsage } from '../../../shared/protocol';
import { fmtNum as fmt, usd } from '../observatorio.format';

export function Trend({ series }: { series: DailyUsage[] }) {
  const dayLabel = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const max = Math.max(1, ...series.map((d) => d.cost));
  const totalCost = series.reduce((a, d) => a + d.cost, 0);
  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-500">
          <Icon name="zap" size={12} /> custo por dia · {series.length}d
        </span>
        <span className="font-mono text-[11px] text-emerald-400/80">{usd(totalCost)}</span>
      </div>
      <div className="flex h-24 items-end gap-1">
        {series.map((d) => {
          const h = Math.max(2, Math.round((d.cost / max) * 100));
          return (
            <div key={d.day} className="group/bar flex flex-1 flex-col items-center justify-end gap-1">
              <div className="relative flex w-full justify-center">
                <div
                  className="w-full max-w-[18px] rounded-sm bg-sky-500/70 transition-colors group-hover/bar:bg-sky-400"
                  style={{ height: `${h}%`, minHeight: '2px' }}
                  title={`${dayLabel(d.day)} · ${usd(d.cost)} · ${fmt(d.output)} out`}
                />
              </div>
              <span className="text-[8.5px] tabular-nums text-neutral-600">{new Date(d.day).getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
