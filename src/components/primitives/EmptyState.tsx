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
  // centers its container.
  size?: 'md' | 'sm';
}

export function EmptyState({ icon, bit, title, description, children, className = '', size = 'md' }: EmptyStateProps) {
  const sm = size === 'sm';
  return (
    <div className={`flex flex-col items-center text-center ${sm ? 'px-6 py-6' : 'h-full justify-center px-6'} ${className}`}>
      {bit ? (
        <Bit state={bit} size={sm ? 64 : 88} className="bit-pop mb-3" />
      ) : icon && (
        <div className={`flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/60 text-neutral-500 ${sm ? 'mb-3 h-10 w-10' : 'mb-4 h-12 w-12'}`}>
          <Icon name={icon} size={sm ? 18 : 22} />
        </div>
      )}
      <h2 className={`font-display font-bold tracking-wide text-neutral-100 ${sm ? 'text-[24px]' : 'text-[28px]'}`}>{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-neutral-400">{description}</p>
      )}
      {children && <div className={`flex w-full max-w-sm flex-col gap-2 ${sm ? 'mt-4' : 'mt-5'}`}>{children}</div>}
    </div>
  );
}
