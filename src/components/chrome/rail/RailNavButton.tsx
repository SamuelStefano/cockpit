import type { ReactNode } from 'react';
import { Icon, Tooltip, tokens, type IconName } from '../../primitives';

interface RailNavButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  count?: number;
  tip?: ReactNode;
  ariaLabel?: string;
}

export function RailNavButton({ icon, label, onClick, active = false, count, tip, ariaLabel }: RailNavButtonProps) {
  return (
    <Tooltip label={tip ?? label} side="right" disabled={!tip} className="flex">
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        aria-current={active ? 'page' : undefined}
        className={`relative flex h-12.5 w-16 shrink-0 flex-col items-center justify-center gap-1.25 rounded-xl text-[10.5px] font-medium transition ${tokens.focusRing} ${active ? 'bg-(--accent-tint) text-(--accent-soft)' : 'text-(--text-muted) hover:bg-neutral-800 hover:text-(--text)'}`}
      >
        <Icon name={icon} size={19} />
        <span>{label}</span>
        {!!count && (
          <span aria-label={`${count} pendentes`} className="absolute right-2.5 top-1 h-4.25 min-w-4.25 rounded-full bg-(--accent) px-1 text-center text-[10px] font-semibold leading-4.25 text-white">{count}</span>
        )}
      </button>
    </Tooltip>
  );
}
