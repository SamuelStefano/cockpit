import type { ReactNode } from 'react';
import { Bit } from '../bit/Bit';
import type { BitState } from '../bit/bit-state';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  icon?: IconName;
  bit?: BitState;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  // `sm`: top-aligned and compact, for pages and panels. The default fills and
  // centers its container. `xs`: one muted line inside a list or column.
  size?: 'md' | 'sm' | 'xs';
}

export function EmptyState({ icon, bit, title, description, children, className = '', size = 'md' }: EmptyStateProps) {
  if (size === 'xs') return <p className={`px-1 py-3 text-center text-[12px] text-neutral-600 ${className}`}>{title}</p>;
  const sm = size === 'sm';
  return (
    <div className={`flex flex-col items-center text-center ${sm ? 'px-6 py-6' : 'h-full justify-center px-6'} ${className}`}>
      {bit ? (
        <Bit state={bit} size={sm ? 40 : 56} className="mb-3" />
      ) : icon && (
        <div className={`flex items-center justify-center rounded-xl bg-orange-500/15 text-orange-300 shadow-[0_3px_0_0_rgba(194,65,12,0.5)] ${sm ? 'mb-3 h-10 w-10' : 'mb-4 h-12 w-12'}`}>
          <Icon name={icon} size={sm ? 18 : 22} />
        </div>
      )}
      <h2 className={`font-bold text-neutral-100 ${sm ? 'text-[20px]' : 'text-[24px]'}`}>{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">{description}</p>
      )}
      {children && <div className={`flex w-full max-w-sm flex-col gap-2 ${sm ? 'mt-4' : 'mt-5'}`}>{children}</div>}
    </div>
  );
}
