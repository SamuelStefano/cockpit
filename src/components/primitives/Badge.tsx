import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'orange' | 'green' | 'red' | 'yellow';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, tone = 'neutral', className = '', dot = false }: BadgeProps) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] text-[10px] font-medium leading-none ${tones[tone]} ${className}`}>
      {dot && <span className="h-1 w-1 rounded-full bg-current" />}
      {children}
    </span>
  );
}
