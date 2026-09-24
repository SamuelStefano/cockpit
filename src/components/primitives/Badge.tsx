import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'orange' | 'green' | 'red' | 'yellow' | 'purple';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
  // Turns the badge into an external link (PR refs, tickets) — same look, clickable.
  href?: string;
  // Same idea as `href`, for an in-app action (focus a node, open a dock)
  // instead of a URL — never both at once.
  onClick?: () => void;
  title?: string;
}

export function Badge({ children, tone = 'neutral', className = '', dot = false, href, onClick, title }: BadgeProps) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    purple: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  };
  const cls = `inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium leading-none ${tones[tone]} ${className}`;
  const body = <>{dot && <span className="h-1 w-1 rounded-full bg-current" />}{children}</>;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title} onClick={(e) => e.stopPropagation()}
        className={`${cls} transition hover:border-orange-500/40 hover:text-orange-300`}>{body}</a>
    );
  }
  if (onClick) {
    return (
      <button type="button" title={title} onClick={onClick}
        className={`${cls} cursor-pointer transition hover:border-orange-500/40 hover:text-orange-300`}>{body}</button>
    );
  }
  return <span className={cls} title={title}>{body}</span>;
}
