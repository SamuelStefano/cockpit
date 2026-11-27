import type { ReactNode } from 'react';

interface SettingsCardProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  // Rows bring their own horizontal padding: the card then only clips and rounds.
  flush?: boolean;
  tone?: 'default' | 'danger';
  className?: string;
  children: ReactNode;
}

export function SettingsCard({ title, description, actions, flush = false, tone = 'default', className = '', children }: SettingsCardProps) {
  const border = tone === 'danger' ? 'border-red-500/25' : 'border-neutral-800';
  const header = title && (
    <div className={`flex items-start justify-between gap-3 ${flush ? 'px-4 pt-4 pb-2' : 'mb-3'}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-100">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
  return (
    <section aria-label={title} className={`overflow-hidden rounded-2xl border ${border} bg-neutral-900/60 hairline ${flush ? '' : 'p-4'} ${className}`}>
      {header}
      {children}
    </section>
  );
}
