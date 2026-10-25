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
}

export function EmptyState({ icon, bit, title, description, children, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex h-full flex-col items-center justify-center px-6 text-center ${className}`}>
      {bit ? (
        <Bit state={bit} size={56} className="mb-3" />
      ) : icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/60 text-neutral-500">
          <Icon name={icon} size={22} />
        </div>
      )}
      <h2 className="text-[17px] font-semibold text-neutral-200">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">{description}</p>
      )}
      {children && <div className="mt-5 flex w-full max-w-sm flex-col gap-2">{children}</div>}
    </div>
  );
}
