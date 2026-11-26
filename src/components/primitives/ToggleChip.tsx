import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { tokens } from './tokens';

type ChipTone = 'accent' | 'danger';

interface ToggleChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  on: boolean;
  icon: IconName;
  tone?: ChipTone;
  children?: ReactNode;
}

const onTone: Record<ChipTone, string> = {
  accent: `border-(--accent-border) bg-orange-500/15 text-(--accent-soft) ${tokens.insetRing.accent}`,
  danger: `border-red-500/50 bg-red-500/15 text-red-300 ${tokens.insetRing.err}`,
};

const ring: Record<ChipTone, string> = {
  accent: tokens.focusRing,
  danger: 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500/40',
};

// Chip de liga/desliga da barra do compositor (skills, MCP, bypass). A geometria
// era copiada letra por letra nos três, incluindo os breakpoints sm: — qualquer
// ajuste de altura desalinhava a barra até alguém achar a cópia esquecida.
export function ToggleChip({ on, icon, tone = 'accent', children, className = '', ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border h-8 px-3 text-[12px] transition ${ring[tone]}
        ${on ? onTone[tone] : 'border-(--border-strong) bg-neutral-950 text-(--text-weak) hover:text-(--text)'} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={12} />
      {children}
    </button>
  );
}
