import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'orange' | 'green' | 'red' | 'yellow';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
  // Turns the badge into an external link (PR refs, tickets) — same look, clickable.
  href?: string;
  title?: string;
}

export function Badge({ children, tone = 'neutral', className = '', dot = false, href, title }: BadgeProps) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };
  const cls = `inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium leading-none ${tones[tone]} ${className}`;
  const body = <>{dot && <span className="h-1 w-1 rounded-full bg-current" />}{children}</>;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title} onClick={(e) => e.stopPropagation()}
        className={`${cls} transition hover:border-orange-500/40 hover:text-orange-300`}>{body}</a>
    );
  }
  return <span className={cls} title={title}>{body}</span>;
}
