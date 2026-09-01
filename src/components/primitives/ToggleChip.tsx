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
  accent: `border-orange-500/50 bg-orange-500/15 text-orange-300 ${tokens.insetRing.accent}`,
  danger: `border-red-500/50 bg-red-500/15 text-red-300 ${tokens.insetRing.err}`,
};

const ring: Record<ChipTone, string> = {
  accent: tokens.focusRing,
  danger: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40',
};

// Chip de liga/desliga da barra do compositor (skills, MCP, bypass). A geometria
// era copiada letra por letra nos três, incluindo os breakpoints sm: — qualquer
// ajuste de altura desalinhava a barra até alguém achar a cópia esquecida.
export function ToggleChip({ on, icon, tone = 'accent', children, className = '', ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition sm:px-2 sm:py-1 ${ring[tone]}
        ${on ? onTone[tone] : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300'} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={12} />
      {children}
    </button>
  );
}
