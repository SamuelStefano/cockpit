import { Icon } from '../../components/primitives';

interface StatProps {
  label: string;
  value: string;
  icon: Parameters<typeof Icon>[0]['name'];
}

export function Stat({ label, value, icon }: StatProps) {
  return (
    <div className="hairline group flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3.5 transition hover:border-orange-500/30 hover:bg-neutral-900/70">
      <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-neutral-500">
        <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-orange-500/10 text-orange-400/80 transition group-hover:bg-orange-500/20">
          <Icon name={icon} size={11} />
        </span>
        {label}
      </span>
      <span className="font-mono text-[22px] font-semibold tabular-nums tracking-tight text-neutral-100">{value}</span>
    </div>
  );
}
