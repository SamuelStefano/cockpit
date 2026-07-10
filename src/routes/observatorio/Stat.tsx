import { Icon } from '../../components/primitives';

interface StatProps {
  label: string;
  value: string;
  icon: Parameters<typeof Icon>[0]['name'];
}

export function Stat({ label, value, icon }: StatProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3.5 hairline">
      <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-neutral-500">
        <Icon name={icon} size={12} /> {label}
      </span>
      <span className="font-mono text-[22px] font-semibold tabular-nums tracking-tight text-neutral-100">{value}</span>
    </div>
  );
}
