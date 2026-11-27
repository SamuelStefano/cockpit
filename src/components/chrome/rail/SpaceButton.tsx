import type { ReactNode } from 'react';
import { Tooltip, tokens } from '../../primitives';

interface SpaceButtonProps {
  label: string;
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
  haspopup?: boolean;
  expanded?: boolean;
}

// One 80px-wide rail slot: the tile in the middle and the pip on the left edge that
// grows on hover and marks the open space.
export function SpaceButton({ label, selected = false, onClick, children, haspopup, expanded }: SpaceButtonProps) {
  return (
    <Tooltip label={label} side="right" className="flex">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={selected ? 'true' : undefined}
        aria-haspopup={haspopup ? 'dialog' : undefined}
        aria-expanded={expanded}
        className={`group relative flex h-13 w-20 shrink-0 items-center justify-center rounded-none ${tokens.focusRing}`}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r transition-[height] duration-150 motion-reduce:transition-none ${selected ? 'h-8 bg-(--accent)' : 'h-0 bg-(--text-weak) group-hover:h-4'}`}
        />
        {children}
      </button>
    </Tooltip>
  );
}
