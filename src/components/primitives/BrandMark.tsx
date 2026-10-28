import { Bit } from '../bit/Bit';
import type { BitState } from '../bit/bit-state';
import { tokens } from './tokens';

interface BrandMarkProps {
  title: string;
  subtitle?: string;
  size?: 'md' | 'lg';
  bitState?: BitState;
  className?: string;
}

const titleSize = { md: 'text-[26px]', lg: 'text-[34px]' } as const;
const subtitleSize = { md: 'text-[12px]', lg: 'text-[13px]' } as const;

// Bit + wordmark das telas de entrada (login por token, login Supabase,
// pareamento da VPS, painel de intro). Os quatro repetiam o mesmo bloco letra por
// letra, incluindo o glow em rgba mágico — mexer na marca exigia caçar as cópias.
export function BrandMark({ title, subtitle, size = 'md', bitState = 'wave', className = '' }: BrandMarkProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Bit state={bitState} size={size === 'lg' ? 52 : 44} />
      <div>
        <div className={`font-display ${titleSize[size]} font-bold leading-none lowercase tracking-tight ${tokens.text.primary}`}>{title}</div>
        {subtitle && <div className={`${subtitleSize[size]} ${tokens.text.muted}`}>{subtitle}</div>}
      </div>
    </div>
  );
}
