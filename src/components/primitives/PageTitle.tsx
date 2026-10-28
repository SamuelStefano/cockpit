import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import type { TileTone } from './IconTile';

const iconTone: Record<TileTone, string> = {
  orange: 'text-orange-400', sky: 'text-sky-400', violet: 'text-violet-400', emerald: 'text-emerald-400',
  amber: 'text-amber-400', rose: 'text-rose-400', neutral: 'text-neutral-400',
};

interface PageTitleProps {
  children: ReactNode;
  icon?: IconName;
  tone?: TileTone;
  badge?: ReactNode;
  className?: string;
}

export function PageTitle({ children, icon, tone = 'orange', badge, className = '' }: PageTitleProps) {
  return (
    <h1 className={`flex items-center gap-2.5 font-display text-[34px] font-bold leading-none tracking-wide text-neutral-50 ${className}`}>
      {icon && <Icon name={icon} size={26} className={iconTone[tone]} />}
      {children}
      {badge}
    </h1>
  );
}
