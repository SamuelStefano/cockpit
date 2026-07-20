import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface RouteHeaderProps {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  // `bar`: barra compacta com título mono minúsculo (rotas-ferramenta: uso, skills,
  // contextos). `page`: cabeçalho de página com título semibold + subtítulo (crons,
  // notas, admin). Os dois compartilham a mesma barra de acento — a assinatura visual.
  variant?: 'bar' | 'page';
  // Linha extra dentro do bloco `bar` (ex: chips de filtro), abaixo do título.
  children?: ReactNode;
  className?: string;
}

function AccentBar({ tall }: { tall?: boolean }) {
  return (
    <span
      aria-hidden
      className={`${tall ? 'h-4' : 'h-3.5'} w-1 shrink-0 rounded-full bg-gradient-to-b from-orange-400 to-orange-600`}
    />
  );
}

export function RouteHeader({ title, subtitle, badge, actions, icon, variant = 'bar', children, className = '' }: RouteHeaderProps) {
  if (variant === 'bar') {
    return (
      <div className={`shrink-0 border-b border-neutral-800/80 px-4 py-3 ${className}`}>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <AccentBar />
            {icon && <Icon name={icon} size={15} className="shrink-0 text-orange-400" />}
            <span className="truncate font-mono text-[15px] font-semibold lowercase tracking-tight text-neutral-100">{title}</span>
            {badge}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
        {subtitle && <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[12.5px] text-neutral-500">{subtitle}</p>}
        {children && <div className="mt-2.5">{children}</div>}
      </div>
    );
  }
  return (
    <header className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight text-neutral-100">
          <AccentBar tall />
          {icon && <Icon name={icon} size={17} className="shrink-0 text-orange-400" />}
          {title}
          {badge}
        </h1>
        {subtitle && <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}
