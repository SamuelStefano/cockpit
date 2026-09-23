import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type StatTone = 'neutral' | 'orange' | 'green' | 'yellow';

interface StatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  tone?: StatTone;
  // plain = no card chrome: several figures inside one parent card.
  plain?: boolean;
  className?: string;
}

const tones: Record<StatTone, { value: string; icon: string; glow: string }> = {
  neutral: { value: 'text-neutral-100', icon: 'text-neutral-500', glow: '' },
  orange: { value: 'text-orange-300', icon: 'text-orange-400', glow: 'bg-orange-500/6' },
  green: { value: 'text-green-300', icon: 'text-green-400', glow: 'bg-green-500/6' },
  yellow: { value: 'text-yellow-300', icon: 'text-yellow-400', glow: 'bg-yellow-500/6' },
};

export function Stat({ label, value, sub, icon, tone = 'neutral', plain = false, className = '' }: StatProps) {
  const t = tones[tone];
  const chrome = plain ? 'min-w-0' : 'overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 px-3.5 py-3 hairline';
  return (
    <div className={`relative ${chrome} ${className}`}>
      {t.glow && !plain && <div aria-hidden className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${t.glow}`} />}
      <div className="relative flex items-center gap-1.5">
        {icon && <Icon name={icon} size={11} className={t.icon} />}
        <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-500">{label}</span>
      </div>
      <div className={`relative mt-1 text-[22px] font-bold leading-none tabular-nums tracking-tight ${t.value}`}>{value}</div>
      {sub != null && <div className="relative mt-1 text-[11px] tabular-nums text-neutral-500">{sub}</div>}
    </div>
  );
}
