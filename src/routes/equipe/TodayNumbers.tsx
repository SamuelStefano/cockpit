import type { TodayCounts } from './org-tree';

const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });

export function TodayNumbers({ counts }: { counts: TodayCounts }) {
  const items: { value: string; label: string }[] = [
    { value: String(counts.working), label: 'trabalhando agora' },
    { value: String(counts.waiting), label: 'esperando você' },
  ];
  if (counts.costUsd !== undefined) items.push({ value: usd.format(counts.costUsd), label: 'gasto hoje · estimado' });
  return (
    <div aria-label="Hoje" className="mb-6 flex flex-wrap gap-2.5">
      {items.map((i) => (
        <div key={i.label} className="hairline flex min-w-[44%] flex-1 flex-col gap-0.5 rounded-xl border border-neutral-800 bg-neutral-900/50 px-3.5 py-3 md:min-w-0">
          <b className="text-[20px] font-semibold tabular-nums text-neutral-100">{i.value}</b>
          <span className="text-[12px] text-neutral-500">{i.label}</span>
        </div>
      ))}
    </div>
  );
}
