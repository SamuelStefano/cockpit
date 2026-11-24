import { Icon, type IconName } from './Icon';
import { tokens } from './tokens';

export interface SideNavItem<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
}

interface SideNavProps<T extends string> {
  items: SideNavItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  label: string;
  className?: string;
}

// Section list: a vertical rail from md up, a horizontal scroller below. One active
// style for Settings, Docs and any future sectioned page.
export function SideNav<T extends string>({ items, active, onSelect, label, className = '' }: SideNavProps<T>) {
  return (
    <nav aria-label={label} className={`scroll-thin flex shrink-0 gap-1 overflow-x-auto md:flex-col md:overflow-visible ${className}`}>
      {items.map((i) => (
        <button
          key={i.id} type="button" aria-current={i.id === active ? 'page' : undefined} onClick={() => onSelect(i.id)}
          className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium pointer-coarse:h-11 ${tokens.focusRing} ${i.id === active ? 'bg-orange-500/15 text-orange-200 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.35)]' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'}`}
        >
          {i.icon && <Icon name={i.icon} size={14} />}{i.label}
        </button>
      ))}
    </nav>
  );
}
