import type { ReactNode } from 'react';

// The square 44px tile behind a non-agent space (all conversations, new agent, +N).
export function SpaceTile({ selected = false, children }: { selected?: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-[14px] border text-[13px] font-semibold transition ${selected ? 'border-(--accent-border) bg-(--accent-tint) text-(--accent-soft)' : 'border-(--border-strong) bg-neutral-800 text-(--text-weak) group-hover:text-(--text)'}`}
    >
      {children}
    </span>
  );
}
