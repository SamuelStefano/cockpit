import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface SectionHeaderProps {
  title: string;
  icon?: IconName;
  count?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

// Heading of a block inside a page (below RouteHeader): gives long pages a
// readable hierarchy without each route inventing its own uppercase label.
export function SectionHeader({ title, icon, count, description, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 ${className}`}>
      <div className="min-w-0 flex-1 basis-60">
        <h2 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] font-semibold tracking-tight text-neutral-100">
          <span className="flex items-center gap-2">
            {icon && <Icon name={icon} size={14} className="shrink-0 text-orange-400" />}
            {title}
          </span>
          {count != null && <span className="whitespace-nowrap text-[12.5px] font-medium tabular-nums text-neutral-500">{count}</span>}
        </h2>
        {description && <p className="mt-0.5 text-[12px] leading-snug text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}
