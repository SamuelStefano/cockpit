import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type PageTone = 'orange' | 'sky' | 'violet' | 'emerald' | 'amber';

const TILE: Record<PageTone, string> = {
  orange: 'bg-orange-500/20 text-orange-300 shadow-[0_3px_0_0_rgba(194,65,12,0.55)]',
  sky: 'bg-sky-500/20 text-sky-300 shadow-[0_3px_0_0_rgba(3,105,161,0.55)]',
  violet: 'bg-violet-500/20 text-violet-300 shadow-[0_3px_0_0_rgba(109,40,217,0.55)]',
  emerald: 'bg-emerald-500/20 text-emerald-300 shadow-[0_3px_0_0_rgba(4,120,87,0.55)]',
  amber: 'bg-amber-500/20 text-amber-300 shadow-[0_3px_0_0_rgba(180,83,9,0.55)]',
};

interface PageTitleProps {
  icon: IconName;
  tone?: PageTone;
  children: ReactNode;
}

// Page heading in the game language: a chunky colored tile (same hue as the
// sidebar entry) beside a large display-face title.
export function PageTitle({ icon, tone = 'orange', children }: PageTitleProps) {
  return (
    <div className="page-title-in flex items-center gap-3">
      <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TILE[tone]}`}>
        <Icon name={icon} size={20} />
      </span>
      <h1 className="font-display text-[32px] leading-none font-bold text-neutral-50">{children}</h1>
    </div>
  );
}
