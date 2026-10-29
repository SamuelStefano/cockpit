import type { ReactNode } from 'react';

// Collapses its children with a fade (grid 1fr -> 0fr) instead of unmounting, so
// leaving focus mode restores them smoothly and keeps their state.
export function FocusCollapse({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return (
    <div
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className={`grid shrink-0 transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${hidden ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
    >
      <div className={`min-h-0 min-w-0 ${hidden ? 'overflow-hidden' : ''}`}>{children}</div>
    </div>
  );
}
