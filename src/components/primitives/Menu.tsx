import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { useMenuKeys } from './useMenuKeys';
import { tokens } from './tokens';

export function Menu({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const { ref, onKeyDown } = useMenuKeys<HTMLDivElement>(true);
  return (
    <div ref={ref} role="menu" aria-label={label} onKeyDown={onKeyDown} className={`flex min-w-56 flex-col p-1.5 ${className}`}>
      {children}
    </div>
  );
}

interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon?: IconName;
  right?: ReactNode;
  danger?: boolean;
}

export function MenuItem({ label, icon, right, danger = false, className = '', ...rest }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      {...rest}
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors pointer-coarse:h-11 pointer-coarse:text-[15px] hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 ${tokens.focusRing} ${danger ? 'text-red-400' : 'text-neutral-100'} ${className}`}
    >
      {icon && <Icon name={icon} size={14} className={danger ? 'text-red-400' : 'text-neutral-400'} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {right && <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-neutral-500">{right}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="mx-1 my-1.5 h-px bg-neutral-800" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[11px] uppercase tracking-[0.04em] text-neutral-500">{children}</div>;
}
