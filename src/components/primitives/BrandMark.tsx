import { Icon } from './Icon';
import { tokens } from './tokens';

interface BrandMarkProps {
  title: string;
  subtitle?: string;
  size?: 'md' | 'lg';
  className?: string;
}

const titleSize = { md: 'text-[15px]', lg: 'text-[17px]' } as const;
const subtitleSize = { md: 'text-[11px]', lg: 'text-[12px]' } as const;

// Selo laranja + wordmark das telas de entrada (login por token, login Supabase,
// pareamento da VPS, painel de intro). Os quatro repetiam o mesmo bloco letra por
// letra, incluindo o glow em rgba mágico — mexer na marca exigia caçar as cópias.
export function BrandMark({ title, subtitle, size = 'md', className = '' }: BrandMarkProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className={`flex h-9 w-9 items-center justify-center bg-orange-500 text-neutral-950 ${tokens.radius.lg} ${tokens.accentGlow}`}>
        <Icon name="terminal" size={16} stroke={2.4} />
      </span>
      <div>
        <div className={`font-mono ${titleSize[size]} font-semibold lowercase tracking-tight ${tokens.text.primary}`}>{title}</div>
        {subtitle && <div className={`${subtitleSize[size]} ${tokens.text.muted}`}>{subtitle}</div>}
      </div>
    </div>
  );
}
