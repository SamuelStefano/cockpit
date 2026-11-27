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
  layout?: 'rail' | 'list';
}

// Section list: a 40px-row rail from md up (horizontal scroller below), or a full-width
// list with chevrons (`layout="list"`) for a phone's index screen.
export function SideNav<T extends string>({ items, active, onSelect, label, className = '', layout = 'rail' }: SideNavProps<T>) {
  const list = layout === 'list';
  return (
    <nav
      aria-label={label}
      className={list
        ? `flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 ${className}`
        : `scroll-thin flex shrink-0 gap-0.5 overflow-x-auto md:flex-col md:overflow-visible ${className}`}
    >
      {items.map((i) => (
        <button
          key={i.id} type="button" aria-current={i.id === active ? 'page' : undefined} onClick={() => onSelect(i.id)}
          className={list
            ? `flex min-h-13 w-full items-center gap-3 border-t border-neutral-800 px-4 text-left text-[14px] text-neutral-100 first:border-t-0 hover:bg-neutral-800/60 ${tokens.focusRing}`
            : `flex h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] border px-3 text-left text-[13px] pointer-coarse:h-11 ${tokens.focusRing} ${i.id === active ? 'border-orange-500/30 bg-orange-500/10 text-neutral-100' : 'border-transparent text-neutral-300 hover:bg-neutral-800'}`}
        >
          {i.icon && <Icon name={i.icon} size={list ? 16 : 14} className={list ? 'text-neutral-400' : i.id === active ? 'text-orange-400' : 'text-neutral-500'} />}
          <span className={list ? 'min-w-0 flex-1 truncate' : undefined}>{i.label}</span>
          {list && <Icon name="chevronRight" size={14} className="shrink-0 text-neutral-500" />}
        </button>
      ))}
    </nav>
  );
}
